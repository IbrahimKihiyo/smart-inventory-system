<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;


class Transaction extends Model
{
    use HasFactory;
    protected $connection = 'tenant';
     protected $fillable = [
        'user_id',
        'payment_method',
        'provider',
        'status',
        'amount',
        'amount_paid',
        'currency',
        'internal_reference_id',
        'external_reference_id',
        'provider_transaction_id',
        'payer_phone',
        'mmo_provider',
        'borrower_name',
        'borrower_phone',
        'pay_before',
        'last_paid_at',
        'is_paid',
        'raw_payload',
    ];

    protected $casts = [
        'raw_payload'  => 'array',
        'amount'       => 'float',
        'amount_paid'  => 'float',
        'is_paid'      => 'boolean',
        'pay_before'   => 'datetime',
        'last_paid_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(TransactionItem::class);
    }
}
