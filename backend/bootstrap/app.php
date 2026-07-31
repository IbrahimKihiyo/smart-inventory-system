<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\InitializeTenancyByHeader;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //
        $middleware->alias([
            'tenant' => InitializeTenancyByHeader::class,
        ]);

        // Ensure tenancy is initialized before bindings and auth run
        $middleware->priority([
            \App\Http\Middleware\InitializeTenancyByHeader::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class, // 👈 Insert this here
            \Illuminate\Auth\Middleware\Authenticate::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
