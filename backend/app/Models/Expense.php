<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $connection = 'tenant';

    protected $table = 'expenses';

    protected $fillable = [
        'user_id',
        'description',
        'category',
        'amount',
        'currency',
        'expense_date',
    ];

    protected $casts = [
        'amount'       => 'decimal:2',
        'expense_date' => 'date',
    ];
}
