<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();

            // Relationships
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // Transaction Info
            $table->enum('payment_method', ['MOBILE_MONEY', 'CASH', 'CREDIT']);
            $table->string('provider'); // 'PAWAPAY'
            $table->string('status')->default('PENDING');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10);

            // Identifiers
            $table->string('internal_reference_id')->unique(); // OrderId
            $table->string('external_reference_id')->index();  // DepositId (Indexed for fast lookup)
            $table->string('provider_transaction_id')->nullable();

            // Payer Info
            $table->string('payer_phone');
            $table->string('mmo_provider'); // e.g., 'AIRTEL_TZA'

            //Borrower Info (for credit transactions)
            $table->string('borrower_name')->nullable();
            $table->string('borrower_phone')->nullable();
            $table->datetime('pay_before')->nullable();
            $table->boolean('is_paid')->default(false);

            // Response Storage
            $table->json('raw_payload')->nullable(); // Stores full callback JSON

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
