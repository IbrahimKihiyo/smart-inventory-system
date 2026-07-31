<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\TransactionItem;
use Illuminate\Validation\Rule;

class CreditTransactionController extends Controller
{
    /**
     * Record a credit (borrow) sale and deduct stock.
     *
     * POST /api/transactions/credit
     *
     * Body:
     * {
     *   "borrower_name":  "John Doe",
     *   "borrower_phone": "+255712345678",
     *   "items": [
     *     { "product_id": 1, "quantity": 2, "unit_price": 5000, "currency": "TZS" }
     *   ],
     *   "amount":   10000,
     *   "currency": "TZS"
     * }
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'borrower_name'      => 'required|string|max:255',
            'borrower_phone'     => ['required', 'string', 'max:20', 'regex:/^\+?\d{9,15}$/'],
            'pay_before'         => 'date',
            'items'              => 'required|array|min:1',
            'items.*.product_id' => ['required' ,'integer', Rule::exists('tenant.products', 'id')],
            'items.*.quantity'   => 'required|numeric|min:0',
            'items.*.unit_price' => 'required|numeric|min:0',
            'items.*.currency'   => 'required|string|max:10',
            'amount'             => 'required|numeric|min:0',
            'currency'           => 'required|string|max:10',
        ]);


        try {

            // Deduct stock
            foreach ($validated['items'] as $item) {
                Product::where('id', $item['product_id'])
                    ->decrement('stock', $item['quantity']);
            }

            $user = $request->user();

            // Record the transaction
            // Borrower info is stored in payer_phone and in raw_payload
            $transaction = Transaction::create([
                'user_id'               => $user->id,
                'payment_method'        => 'CREDIT',
                'provider'              => 'CREDIT',
                'status'                => 'PENDING',   // awaiting repayment
                'amount'                => $validated['amount'],
                'currency'              => $validated['currency'],
                'internal_reference_id' => 'CREDIT-' . strtoupper(Str::ulid()),
                'external_reference_id' => 'CREDIT-' . strtoupper(Str::ulid()),
                'payer_phone'           => $validated['borrower_phone'],
                'mmo_provider'          => 'CREDIT',
                'borrower_name'         => $validated['borrower_name'],
                'borrower_phone'        => $validated['borrower_phone'],
                'pay_before'            => $validated['pay_before'],
            ]);



            // ✅ Add Transaction Items
            foreach ($validated['items'] as $item) {

                $unitPrice = ceil((float) $item['unit_price']);
                $subtotal   = ceil($unitPrice * $item['quantity']);

                TransactionItem::create([
                    'transaction_id' => $transaction->id,
                    'product_id'     => $item['product_id'],
                    'quantity'       => $item['quantity'],
                    'unit_price'     => $unitPrice,
                    'subtotal'       => $subtotal,
                ]);
            }


            return response()->json([
                'message'     => 'Credit sale recorded. Borrower: ' . $validated['borrower_name'] . '.',
                'transaction' => $transaction,
            ], 201);

        } catch (\Throwable $e) {

            return response()->json([
                'message' => 'An error occurred while recording the credit sale.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }



    /**
     * Record a repayment against a credit sale.
     *
     * A partial amount may be sent, in which case the debt is marked as
     * partially paid and the balance is kept. When nothing is sent, or the
     * amount clears the balance, the debt is marked as fully paid.
     *
     * PATCH /api/transactions/credit/{id}/repay
     * Body (optional): { "amount": 5000 }
     */
    public function repay(Request $request, int $id)
    {
        $transaction = Transaction::where('payment_method', 'CREDIT')
            ->where('status', '!=', 'COMPLETED')
            ->findOrFail($id);

        $validated = $request->validate([
            'amount' => 'nullable|numeric|min:0',
        ]);

        $total       = (float) $transaction->amount;
        $alreadyPaid = (float) $transaction->amount_paid;
        $remaining   = max(0, $total - $alreadyPaid);

        // No amount given means "settle the whole remaining balance now".
        $payment = isset($validated['amount']) && (float) $validated['amount'] > 0
            ? (float) $validated['amount']
            : $remaining;

        // Never accept more than what is still owed.
        $payment = min($payment, $remaining);

        $newPaid   = $alreadyPaid + $payment;
        $fullyPaid = $newPaid >= ($total - 0.001);

        $transaction->update([
            'amount_paid'  => $newPaid,
            'last_paid_at' => now(),
            'status'       => $fullyPaid ? 'COMPLETED' : 'PARTIAL',
            'is_paid'      => $fullyPaid,
        ]);

        return response()->json([
            'message'     => $fullyPaid
                ? 'Credit fully repaid.'
                : 'Partial payment recorded.',
            'transaction' => $transaction->fresh(),
        ]);
    }
}
