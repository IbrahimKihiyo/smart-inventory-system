<?php
// app/Models/Tenant.php

namespace App\Models;

use Spatie\Multitenancy\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant
{
    protected $connection = 'landlord';

    protected $fillable = [
        'name',
        'slug',
        'domain',
        'database',
    ];

    public function getDatabaseName(): string
    {
        return $this->database;
    }

    // ← NO booted() hook here anymore
    // Schema is created explicitly in TenantRegistrationController
    // before DB::beginTransaction() to avoid transaction-inside-DDL issues
}
