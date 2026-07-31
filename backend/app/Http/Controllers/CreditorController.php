<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use Illuminate\Http\Request;

class CreditorController extends Controller
{
    public function index()
    {
        // Retrieve transactions where payment_method is CREDIT
        $creditors = Transaction::where('payment_method', 'CREDIT')
            ->latest()
            ->get();

        return response()->json($creditors);
    }
}
