<?php
// app/Http/Controllers/TenantRegistrationController.php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Throwable;

class TenantRegistrationController extends Controller
{
    public function register(Request $request)
    {
        // Bot trap: a genuine client never fills this hidden field.
        if (filled($request->input('website'))) {
            return response()->json(['message' => 'Request rejected.'], 422);
        }

        // Reject any field that is not expected, to block tampered requests.
        $allowed = [
            'company_name', 'admin_name', 'admin_email',
            'admin_password', 'admin_password_confirmation', 'website',
        ];
        if (count(array_diff(array_keys($request->all()), $allowed)) > 0) {
            return response()->json(['message' => 'Unexpected fields in the request.'], 422);
        }

        // Limit how many businesses one address can create: 5 per 10 minutes.
        $key = 'register:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message'     => "Too many attempts. Please wait {$seconds} seconds and try again.",
                'retry_after' => $seconds,
            ], 429);
        }
        RateLimiter::hit($key, 600);

        $validated = $request->validate([
            'company_name'               => 'required|string|max:255',
            'admin_name'                 => 'required|string|max:255',
            'admin_email'                => 'required|email|max:255',
            'admin_password'             => 'required|string|min:8|confirmed',
        ]);

        $slug   = Str::slug($validated['company_name']);
        $schema = 'tenant_' . $slug;
        $domain = $slug . '.localhost';

        // Ensure slug uniqueness
        $original = $slug;
        $counter  = 1;
        while (Tenant::where('slug', $slug)->exists()) {
            $slug   = $original . '_' . $counter;
            $schema = 'tenant_' . $slug;
            $domain = $slug . '.localhost';
            $counter++;
        }

        try {
            // Step 1: Create the PostgreSQL schema.
            // This runs outside any transaction because PostgreSQL DDL auto-commits
            // and cannot be rolled back, so we clean up manually on failure.
            DB::statement("CREATE SCHEMA IF NOT EXISTS \"{$schema}\"");

            // Step 2: Create tenant record (landlord DB)
            $tenant = Tenant::create([
                'name'     => $validated['company_name'],
                'slug'     => $slug,
                'domain'   => $domain,
                'database' => $schema,
            ]);

            // Step 3: Switch search_path on the tenant connection
            $this->switchToSchema($schema);

            // Step 4: Run tenant migrations IN THIS PROCESS
            $this->runMigrationsInProcess($schema);

            // Step 5: Create admin user in tenant schema
            $admin           = new User();
            $admin->name     = $validated['admin_name'];
            $admin->email    = $validated['admin_email'];
            $admin->password = Hash::make($validated['admin_password']);
            $admin->role     = 'admin';
            $admin->save();

            // Step 6: Issue Sanctum token
            $token = $admin->createToken('admin_token')->plainTextToken;

            // Step 7: Reset back to public schema
            $this->switchToSchema('public');
            Tenant::forgetCurrent();

            return response()->json([
                'message' => 'Tenant registered successfully.',
                'tenant'  => [
                    'id'     => $tenant->id,
                    'name'   => $tenant->name,
                    'slug'   => $tenant->slug,
                    'domain' => $tenant->domain,
                ],
                'admin' => [
                    'id'    => $admin->id,
                    'name'  => $admin->name,
                    'email' => $admin->email,
                    'role'  => $admin->role,
                ],
                'token' => $token,
            ], 201);

        } catch (Throwable $e) {
            // Reset connection state
            $this->switchToSchema('public');
            Tenant::forgetCurrent();

            // Drop the schema if it was created (manual DDL rollback)
            try {
                DB::statement("DROP SCHEMA IF EXISTS \"{$schema}\" CASCADE");
            } catch (Throwable) {}

            // Also remove the tenant record if it was created
            try {
                Tenant::where('slug', $slug)->delete();
            } catch (Throwable) {}

            return response()->json([
                'message' => 'Tenant registration failed.',
                'error'   => $e->getMessage(),
                'trace'   => config('app.debug') ? $e->getTraceAsString() : null,
            ], 500);
        }
    }

    /**
     * Switch the tenant DB connection to the given PostgreSQL schema
     * by setting search_path directly on the live PDO connection.
     * This stays in the current PHP process, with no subprocess or Artisan call.
     */
    private function switchToSchema(string $schema): void
    {
        // Update Laravel config so any fresh connections also use this schema
        config([
            'database.connections.tenant.search_path' => "\"{$schema}\"",
            'database.connections.tenant.schema'      => $schema,
        ]);

        // Purge cached connection so the config change takes effect
        DB::purge('tenant');

        // Set search_path on the new live connection
        DB::connection('tenant')->statement("SET search_path TO \"{$schema}\"");
    }

    /**
     * Run tenant migrations using Laravel's Migrator directly, in the same
     * process, connection, and search_path. No subprocess from Artisan::call.
     */
    private function runMigrationsInProcess(string $schema): void
    {
        /** @var Migrator $migrator */
        $migrator = app('migrator');

        // Tell the migrator to use the tenant connection
        $migrator->setConnection('tenant');

        // Ensure the migrations table exists in this schema
        if (!$migrator->repositoryExists()) {
            $migrator->getRepository()->createRepository();
        }

        // Path to your tenant migration files
        $migrationPath = database_path('migrations/tenant');

        // Run all pending migrations and return the names of those that ran
        $migrator->run([$migrationPath], [
            'pretend' => false,
            'step'    => false,
        ]);
    }
}
