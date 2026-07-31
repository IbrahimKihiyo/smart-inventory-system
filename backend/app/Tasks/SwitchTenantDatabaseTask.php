<?php
// app/Tasks/SwitchTenantDatabaseTask.php

namespace App\Tasks;

use Illuminate\Support\Facades\DB;
use Spatie\Multitenancy\Contracts\IsTenant;
use Spatie\Multitenancy\Tasks\SwitchTenantTask;
use App\Models\Tenant;

class SwitchTenantDatabaseTask implements SwitchTenantTask
{
    public function makeCurrent(IsTenant $tenant): void
    {
        /** @var Tenant $tenant */
        $this->setSearchPath($tenant->database);
    }

    public function forgetCurrent(): void
    {
        $this->setSearchPath('public');
    }

    protected function setSearchPath(string $schema): void
    {
        // Update config so any new connections use the right schema
        config(['database.connections.tenant.search_path' => "\"{$schema}\"",
                'database.connections.tenant.schema'      => $schema]);

        // Purge and reconnect so the new search_path takes effect
        DB::purge('tenant');
        DB::reconnect('tenant');

        // Explicitly set it on the live connection
        DB::connection('tenant')->statement("SET search_path TO \"{$schema}\"");
    }
}
