<?php
// app/Models/TenantPersonalAccessToken.php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumToken;

class TenantPersonalAccessToken extends SanctumToken
{
    protected $table      = 'personal_access_tokens';
    protected $connection = 'tenant';

    /**
     * Override findToken so Sanctum always queries the tenant connection.
     * This is called statically by Sanctum's Guard before any middleware
     * has a chance to switch the search_path — so we must set it here.
     */
    public static function findToken($token)
    {
        // Extract tenant slug from the current request header
        $slug = request()->header('X-Tenant');

        if ($slug) {
            // Switch search_path on the tenant connection right now,
            // before the query runs, regardless of middleware order
            $schema = 'tenant_' . \Illuminate\Support\Str::slug($slug);
            \Illuminate\Support\Facades\DB::connection('tenant')
                ->statement("SET search_path TO \"{$schema}\"");
        }

        return parent::findToken($token);
    }
}
