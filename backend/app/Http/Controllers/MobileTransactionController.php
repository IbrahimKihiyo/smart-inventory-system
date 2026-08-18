<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\TransactionItem;
use Illuminate\Validation\Rule;

class MobileTransactionController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'items'                => 'required|array|min:1',
            'items.*.product_id'   => ['required', 'integer', Rule::exists('tenant.products', 'id')],
            'items.*.quantity'     => 'required|numeric|min:0',
            'items.*.unit_price'   => 'required|numeric|min:0',
            'items.*.currency'     => 'required|string|max:10',
            'items.*.subtotal_tzs' => 'nullable|numeric|min:0',
            'amount'               => 'required|numeric|min:0',
            'currency'             => 'required|string|max:10',
            'payer_phone'          => 'nullable|string|max:20',
        ]);

        try {

            // Deduct stock
            foreach ($validated['items'] as $item) {
                Product::where('id', $item['product_id'])
                    ->decrement('stock', $item['quantity']);
            }

            $user = $request->user();

            $transaction = Transaction::create([
                'user_id'               => $user->id,
                'payment_method'        => 'MOBILE',
                'provider'              => 'MOBILE',
                'status'                => 'COMPLETED',
                'amount'                => $validated['amount'],
                'currency'              => $validated['currency'],
                'internal_reference_id' => 'MOBILE-' . strtoupper(Str::ulid()),
                'external_reference_id' => 'MOBILE-' . strtoupper(Str::ulid()),
                'payer_phone'           => $validated['payer_phone'] ?? '',
                'mmo_provider'          => 'MOBILE',
            ]);

            foreach ($validated['items'] as $item) {
                $unitPrice = ceil((float) $item['unit_price']);
                $quantity  = $item['quantity'];

                $subtotalTzs = isset($item['subtotal_tzs'])
                    ? ceil((float) $item['subtotal_tzs'])
                    : ceil($unitPrice * $quantity);

                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'product_id'     => $item['product_id'],
                    'quantity'       => $quantity,
                    'unit_price'     => $unitPrice,
                    'subtotal'       => $subtotalTzs,
                ]);
            }

            return response()->json([
                'message'     => 'Mobile payment recorded successfully.',
                'transaction' => $transaction,
            ], 201);

        } catch (\Throwable $e) {

            return response()->json([
                'message' => 'An error occurred while recording the mobile payment.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}
