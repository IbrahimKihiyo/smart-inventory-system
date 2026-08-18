<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Database\Migrations\Migrator;
use Illuminate\Support\Facades\DB;
use Throwable;

class MigrateTenants extends Command
{
    protected $signature = 'tenants:migrate';

    protected $description = 'Run any pending tenant migrations for every tenant schema';

    public function handle(): int
    {
        $path = database_path('migrations/tenant');

        foreach (Tenant::all() as $tenant) {
            $schema = $tenant->database;
            if (!$schema) {
                continue;
            }

            try {
                // Point the tenant connection at this tenant's schema.
                config([
                    'database.connections.tenant.search_path' => "\"{$schema}\"",
                    'database.connections.tenant.schema'      => $schema,
                ]);
                DB::purge('tenant');
                DB::connection('tenant')->statement("SET search_path TO \"{$schema}\"");

                /** @var Migrator $migrator */
                $migrator = app('migrator');
                $migrator->setConnection('tenant');

                if (!$migrator->repositoryExists()) {
                    $migrator->getRepository()->createRepository();
                }

                $ran = $migrator->run([$path], ['pretend' => false, 'step' => false]);
                $names = array_map(fn ($p) => basename($p), $ran);
                $this->info("{$tenant->slug}: " . (count($names) ? implode(', ', $names) : 'up to date'));
            } catch (Throwable $e) {
                $this->error("{$tenant->slug}: " . $e->getMessage());
            }
        }

        // Reset the tenant connection back to the public schema.
        config([
            'database.connections.tenant.search_path' => 'public',
            'database.connections.tenant.schema'      => 'public',
        ]);
        DB::purge('tenant');

        return self::SUCCESS;
    }
}
