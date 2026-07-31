<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    protected $connection = 'tenant';

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'products';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'sku',
        'category_id',
        'image',
        'name',
        'description',
        'currency',
        'price',
        'buying_price',
        'stock',
        'expiry_date',
        'unit',
        'allow_decimal'
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'price'       => 'float',
        'stock'       => 'float',
        'category_id' => 'integer',
        'expiry_date' => 'datetime',
        'allow_decimal' => 'boolean',
    ];

    /**
     * Get the category that owns the product.
     *
     * @return BelongsTo
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id', 'id');
    }

    public function transactionItems(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    /**
     * Get the historical purchase (buying) prices recorded for this product.
     *
     * @return HasMany
     */
    public function purchasePrices(): HasMany
    {
        return $this->hasMany(PurchasePrice::class);
    }
}
