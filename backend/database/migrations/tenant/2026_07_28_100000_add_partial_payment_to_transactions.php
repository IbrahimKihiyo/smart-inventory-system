<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds the columns needed to track partial repayment of a credit sale:
     * how much has been paid so far, and when the last payment was made.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('amount_paid', 15, 2)->default(0)->after('amount');
            $table->datetime('last_paid_at')->nullable()->after('pay_before');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['amount_paid', 'last_paid_at']);
        });
    }
};
