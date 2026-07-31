<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchasePrice extends Model
{
    use HasFactory;

    protected $connection = 'tenant';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'product_id',
        'price',
        'currency',
        'quantity',
        'note',
        'purchased_at',
    ];

    protected $casts = [
        'price'        => 'float',
        'quantity'     => 'float',
        'purchased_at' => 'datetime',
    ];

    /**
     * Get the product this purchase price belongs to.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
