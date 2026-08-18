<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DashboardController extends Controller
{
    private function convertToTzs(float $amount, string $fromCurrency): float
    {
        if (strtoupper($fromCurrency) === 'TZS') {
            return $amount;
        }

        $apiKey = env('EXCONVERT_API_KEY');

        try {
            $response = Http::timeout(10)->get('https://api.exconvert.com/convert', [
                'access_key' => $apiKey,
                'from'       => strtoupper($fromCurrency),
                'to'         => 'TZS',
                'amount'     => $amount,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                if (isset($data['result']['TZS'])) {
                    return (float) $data['result']['TZS'];
                }
            }
        } catch (\Exception $e) {
            Log::warning("Currency conversion failed for {$fromCurrency}: " . $e->getMessage());
        }

        Log::error("Could not convert {$fromCurrency} to TZS. Using original amount.");

        return $amount;
    }

    public function getMetrics(Request $request): JsonResponse
    {
        try {

            $user = Auth::user();
            $isAdmin = $user && $user->role === 'admin';

            /*
            |--------------------------------------------------------------------------
            | Date Range (defaults to today)
            |--------------------------------------------------------------------------
            */
            $startDate = $request->filled('start_date')
                ? Carbon::parse($request->input('start_date'))->startOfDay()
                : Carbon::today()->startOfDay();

            $endDate = $request->filled('end_date')
                ? Carbon::parse($request->input('end_date'))->endOfDay()
                : Carbon::today()->endOfDay();

            $transactionQuery = Transaction::query()
                ->whereBetween('created_at', [$startDate, $endDate]);

            $itemQuery = TransactionItem::query()
                ->whereHas('transaction', function ($q) use ($startDate, $endDate) {
                    $q->whereBetween('created_at', [$startDate, $endDate]);
                });

            // Restrict normal users
            if (!$isAdmin) {
                $transactionQuery->where('user_id', $user->id);

                $itemQuery->whereHas('transaction', function ($q) use ($user, $startDate, $endDate) {
                    $q->where('user_id', $user->id)
                      ->whereBetween('created_at', [$startDate, $endDate]);
                });
            }

            /*
            |--------------------------------------------------------------------------
            | Total Quantity Sold
            |--------------------------------------------------------------------------
            */
            $totalQuantitySold = (clone $itemQuery)
                ->whereHas('transaction', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'COMPLETED')
                      ->whereBetween('created_at', [$startDate, $endDate]);
                })
                ->sum('quantity');

            /*
            |--------------------------------------------------------------------------
            | Total Sales Amount (TZS)
            |--------------------------------------------------------------------------
            */
            $amountsByCurrency = (clone $transactionQuery)
                ->where('status', 'COMPLETED')
                ->select('currency', DB::raw('SUM(amount) as total'))
                ->groupBy('currency')
                ->get();

            $totalAmountTzs = 0;
            $conversionBreakdown = [];

            foreach ($amountsByCurrency as $row) {
                $convertedAmount = $this->convertToTzs((float)$row->total, $row->currency);

                $totalAmountTzs += $convertedAmount;

                $conversionBreakdown[] = [
                    'original_currency' => $row->currency,
                    'original_amount'   => (float)$row->total,
                    'converted_tzs'     => $convertedAmount
                ];
            }

            /*
            |--------------------------------------------------------------------------
            | Top Products
            |--------------------------------------------------------------------------
            */
            $topProducts = (clone $itemQuery)
                ->whereHas('transaction', function ($q) use ($startDate, $endDate) {
                    $q->where('status', 'COMPLETED')
                      ->whereBetween('created_at', [$startDate, $endDate]);
                })
                ->select('product_id', DB::raw('SUM(quantity) as total_sold'))
                ->with('product:id,name')
                ->groupBy('product_id')
                ->orderByDesc('total_sold')
                ->take(10)
                ->get()
                ->map(function ($item) {
                    return [
                        'name' => $item->product?->name ?? 'Unknown Product',
                        'total_sold' => $item->total_sold
                    ];
                });

            /*
            |--------------------------------------------------------------------------
            | Total Transactions
            |--------------------------------------------------------------------------
            */
            $totalTransactions = (clone $transactionQuery)->count();

            /*
            |--------------------------------------------------------------------------
            | Pending Credit
            |--------------------------------------------------------------------------
            */
            $pendingCreditByCurrency = (clone $transactionQuery)
                ->where('payment_method', 'CREDIT')
                ->where('status', '!=', 'COMPLETED')
                ->select('currency', DB::raw('SUM(amount) as total'))
                ->groupBy('currency')
                ->get();

            $pendingCreditAmountTzs = 0;

            foreach ($pendingCreditByCurrency as $row) {
                $pendingCreditAmountTzs += $this->convertToTzs(
                    (float) $row->total,
                    $row->currency
                );
            }

            /*
            |--------------------------------------------------------------------------
            | PROFIT (CASHFLOW PROFIT)
            |--------------------------------------------------------------------------
            */
            $totalProfitQuery = TransactionItem::join('products', 'products.id', '=', 'transaction_items.product_id')
                ->join('transactions', 'transactions.id', '=', 'transaction_items.transaction_id')
                ->where('transactions.status', 'COMPLETED')
                ->whereBetween('transactions.created_at', [$startDate, $endDate]);

            if (!$isAdmin) {
                $totalProfitQuery->where('transactions.user_id', $user->id);
            }

            $totalProfit = $totalProfitQuery
                ->selectRaw('SUM((transaction_items.unit_price - products.buying_price) * transaction_items.quantity) as total_profit')
                ->value('total_profit');

            // Total business expenses in the same date range, and the resulting net profit.
            $totalExpenses = (float) Expense::whereBetween('expense_date', [
                $startDate->toDateString(),
                $endDate->toDateString(),
            ])->sum('amount');

            $netProfit = (float) ($totalProfit ?? 0) - $totalExpenses;

            /*
            |--------------------------------------------------------------------------
            | RESPONSE
            |--------------------------------------------------------------------------
            */
            return response()->json([
                'status' => 'success',
                'metrics' => [
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                    'total_quantity_sold' => $totalQuantitySold,
                    'total_amount_tzs' => round($totalAmountTzs, 2),
                    'total_transactions' => $totalTransactions,
                    'pending_credit_amount_tzs' => round($pendingCreditAmountTzs, 2),
                    'total_profit' => round($totalProfit ?? 0, 2),
                    'total_expenses' => round($totalExpenses, 2),
                    'net_profit' => round($netProfit, 2),
                    'top_products' => $topProducts,
                    'conversion_breakdown' => $conversionBreakdown,
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to fetch dashboard metrics.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}