<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Stores the historical purchase (buying) price of a product each time
     * the shop owner restocks it. This price history powers the Buying
     * Advisor, which recommends restocking when the current market price is
     * below the average of the last three recorded purchases (FR12 & FR13).
     */
    public function up(): void
    {
        Schema::create('purchase_prices', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                  ->constrained('products')
                  ->cascadeOnDelete();

            // The price paid for ONE unit on this purchase
            $table->decimal('price', 15, 2);
            $table->string('currency', 5);

            // How much stock was bought on this purchase (added to product stock)
            $table->decimal('quantity', 10, 2)->default(0);

            // Optional note, e.g. supplier name
            $table->string('note')->nullable();

            // When the purchase was made (defaults to the recording time)
            $table->datetime('purchased_at');

            $table->timestamps();

            // Indexes to fetch a product's most recent purchases quickly
            $table->index('product_id');
            $table->index('purchased_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_prices');
    }
};
