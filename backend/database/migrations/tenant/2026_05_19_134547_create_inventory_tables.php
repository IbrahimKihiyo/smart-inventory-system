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
        // 1. Categories Table
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->timestamps(); // Generates created_at and updated_at

            // Index translation
            $table->index('name');
        });



        // 2. Products Table
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('sku', 100)->unique();

            $table->foreignId('category_id')
                  ->nullable()
                  ->constrained('categories')
                  ->nullOnDelete();

            $table->string('image')->nullable();
            $table->string('name', 100)->unique();


            $table->text('description')->nullable();
            $table->string('currency', 5);
            $table->decimal('price', 10, 2);
            $table->decimal('buying_price',10,2);

            $table->string('unit', 20)->default('pcs'); // pcs, kg, g, l, ml, box, etc.
            $table->boolean('allow_decimal')->default(false);

            $table->decimal('stock', 10,2);
            $table->datetime('expiry_date')->nullable();
            $table->timestamps(); // Generates created_at and updated_at

            // Composite or single indexes translation
            $table->index('category_id');
            $table->index('name');
            $table->index('expiry_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_tables');
    }
};
