<?php
// app/Http/Middleware/InitializeTenancyByHeader.php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class InitializeTenancyByHeader
{
    public function handle(Request $request, Closure $next): Response
    {
        $slug = $request->header('X-Tenant');

        if (!$slug) {
            return response()->json([
                'message' => 'Tenant identifier missing. Include X-Tenant header.',
            ], 400);
        }

        $tenant = Tenant::where('slug', $slug)->first();

        if (!$tenant) {
            return response()->json([
                'message' => "Tenant '{$slug}' not found.",
            ], 404);
        }

        // Switch search_path BEFORE anything else runs (including auth:sanctum)
        $schema = $tenant->database;

        config([
            'database.connections.tenant.search_path' => "\"{$schema}\"",
            'database.connections.tenant.schema'      => $schema,
        ]);

        DB::purge('tenant');
        DB::connection('tenant')->statement("SET search_path TO \"{$schema}\"");

        $tenant->makeCurrent();

        $response = $next($request);

        // Reset after request completes
        DB::purge('tenant');
        config([
            'database.connections.tenant.search_path' => 'public',
            'database.connections.tenant.schema'      => 'public',
        ]);
        Tenant::forgetCurrent();

        return $response;
    }
}
