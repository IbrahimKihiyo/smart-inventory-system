<?php
// app/Http/Controllers/TenantRegistrationController.php

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Throwable;

class TenantRegistrationController extends Controller
{
    public function register(Request $request)
    {
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
            // ── Step 1: Create PostgreSQL schema ──────────────────────────────
            // Done OUTSIDE any transaction — PostgreSQL DDL auto-commits and
            // cannot be rolled back, so we handle cleanup manually on failure.
            DB::statement("CREATE SCHEMA IF NOT EXISTS \"{$schema}\"");

            // ── Step 2: Create tenant record (landlord DB) ────────────────────
            $tenant = Tenant::create([
                'name'     => $validated['company_name'],
                'slug'     => $slug,
                'domain'   => $domain,
                'database' => $schema,
            ]);

            // ── Step 3: Switch search_path on the tenant connection ───────────
            $this->switchToSchema($schema);

            // ── Step 4: Run tenant migrations IN THIS PROCESS ─────────────────
            $this->runMigrationsInProcess($schema);

            // ── Step 5: Create admin user in tenant schema ────────────────────
            $admin           = new User();
            $admin->name     = $validated['admin_name'];
            $admin->email    = $validated['admin_email'];
            $admin->password = Hash::make($validated['admin_password']);
            $admin->role     = 'admin';
            $admin->save();

            // ── Step 6: Issue Sanctum token ───────────────────────────────────
            $token = $admin->createToken('admin_token')->plainTextToken;

            // ── Step 7: Reset back to public schema ───────────────────────────
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
     * This stays in the current PHP process — no subprocess, no Artisan.
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
     * Run tenant migrations using Laravel's Migrator directly — same process,
     * same connection, same search_path. No subprocess spawned by Artisan::call.
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

        // Run all pending migrations — returns array of ran migration names
        $migrator->run([$migrationPath], [
            'pretend' => false,
            'step'    => false,
        ]);
    }
}
