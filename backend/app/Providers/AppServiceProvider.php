<?php
// app/Providers/AppServiceProvider.php

namespace App\Providers;

use App\Models\TenantPersonalAccessToken;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Register early in the container lifecycle
        Sanctum::usePersonalAccessTokenModel(TenantPersonalAccessToken::class);
    }

    public function boot(): void
    {
        // Also set here as a safety net
        Sanctum::usePersonalAccessTokenModel(TenantPersonalAccessToken::class);
    }
}
