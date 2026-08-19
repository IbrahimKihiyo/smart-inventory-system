<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Provides the "smart" decision-support figures for the assistant:
 *   - Demand forecast   (moving average of recent daily sales)
 *   - Reorder point      (average daily demand x lead time + safety stock)
 *   - Anomaly detection  (daily sales that fall outside the normal range)
 *
 * All the logic is transparent and rule based. Nothing is a trained model;
 * every number can be explained from the shop's own sales history.
 */
class AnalyticsController extends Controller
{
    public function insights(Request $request): JsonResponse
    {
        try {
            // How many past days of sales history to learn from (default four weeks).
            $days   = (int) $request->query('days', 28);
            $days   = max(7, min($days, 120));

            // Lead time: how many days it takes for new stock to arrive after ordering.
            $lead   = (int) $request->query('lead', 3);
            $lead   = max(1, min($lead, 60));

            // Review period: how often the owner places an order (weekly by default).
            $review    = 7;
            // Extra days of stock kept as a cushion against sudden demand.
            $safetyDays = 3;

            $end   = Carbon::now()->endOfDay();
            $start = Carbon::now()->subDays($days)->startOfDay();

            /*
            | 1. Total quantity sold per product in the window (COMPLETED sales only).
            |    A range filter on created_at keeps this time-zone safe.
            */
            $soldByProduct = TransactionItem::query()
                ->whereHas('transaction', function ($q) use ($start, $end) {
                    $q->where('status', 'COMPLETED')
                      ->whereBetween('created_at', [$start, $end]);
                })
                ->select('product_id', DB::raw('SUM(quantity) as qty'))
                ->groupBy('product_id')
                ->pluck('qty', 'product_id');

            $products = Product::query()->get(['id', 'name', 'stock', 'buying_price', 'price']);

            $forecasts = [];
            $reorder   = [];

            foreach ($products as $p) {
                $totalSold = (float) ($soldByProduct[$p->id] ?? 0);
                $avgDaily  = $totalSold / $days;              // moving-average demand
                $stock     = (float) $p->stock;

                if ($avgDaily > 0) {
                    $forecastNext7 = round($avgDaily * 7, 1);
                    $daysCover     = (int) floor($stock / $avgDaily);
                    $safetyStock   = (int) ceil($avgDaily * $safetyDays);
                    $reorderPoint  = (int) ceil($avgDaily * $lead + $safetyStock);
                    $targetLevel   = $avgDaily * ($lead + $review) + $safetyStock;
                    $orderQty      = (int) max(ceil($targetLevel - $stock), 0);

                    $forecasts[] = [
                        'product_id'       => $p->id,
                        'name'             => $p->name,
                        'avg_daily_demand' => round($avgDaily, 2),
                        'forecast_next_7'  => $forecastNext7,
                        'current_stock'    => $stock,
                        'days_cover'       => $daysCover,
                    ];

                    // Flag for reorder when the shelf is at or below the reorder point.
                    if ($stock <= $reorderPoint) {
                        $reorder[] = [
                            'product_id'         => $p->id,
                            'name'               => $p->name,
                            'current_stock'      => $stock,
                            'reorder_point'      => $reorderPoint,
                            'suggested_order_qty'=> $orderQty,
                            'avg_daily_demand'   => round($avgDaily, 2),
                        ];
                    }
                }
            }

            // Fastest movers first; most urgent (least days of cover) first.
            usort($forecasts, fn ($a, $b) => $b['avg_daily_demand'] <=> $a['avg_daily_demand']);
            usort($reorder, fn ($a, $b) => $a['current_stock'] <=> $b['current_stock']);

            /*
            | 2. Anomaly detection on daily sales.
            |    Build a value for every day, then flag any day more than two
            |    standard deviations away from the average (unusually high or low).
            */
            $txns = Transaction::query()
                ->where('status', 'COMPLETED')
                ->whereBetween('created_at', [$start, $end])
                ->get(['created_at', 'amount']);

            $daily = [];
            for ($i = 0; $i < $days; $i++) {
                $daily[Carbon::now()->subDays($i)->toDateString()] = 0.0;
            }
            foreach ($txns as $t) {
                $key = Carbon::parse($t->created_at)->toDateString();
                if (array_key_exists($key, $daily)) {
                    $daily[$key] += (float) $t->amount;
                }
            }

            $values = array_values($daily);
            $n      = count($values);
            $mean   = $n ? array_sum($values) / $n : 0.0;
            $variance = 0.0;
            foreach ($values as $v) {
                $variance += ($v - $mean) ** 2;
            }
            $std = $n ? sqrt($variance / $n) : 0.0;

            $anomalyDays = [];
            if ($std > 0) {
                foreach ($daily as $date => $amount) {
                    if (abs($amount - $mean) > 2 * $std) {
                        $anomalyDays[] = [
                            'date'          => $date,
                            'amount'        => round($amount, 2),
                            'expected'      => round($mean, 2),
                            'deviation_pct' => $mean > 0 ? (int) round(($amount - $mean) / $mean * 100) : 0,
                            'type'          => $amount > $mean ? 'HIGH' : 'LOW',
                        ];
                    }
                }
                // Report the most extreme days first, at most five.
                usort($anomalyDays, fn ($a, $b) => abs($b['deviation_pct']) <=> abs($a['deviation_pct']));
                $anomalyDays = array_slice($anomalyDays, 0, 5);
            }

            return response()->json([
                'status'    => 'success',
                'analytics' => [
                    'period_days'        => $days,
                    'lead_time_days'     => $lead,
                    'review_period_days' => $review,
                    'forecasts'          => array_slice($forecasts, 0, 10),
                    'reorder'            => $reorder,
                    'anomalies'          => [
                        'mean_daily_sales' => round($mean, 2),
                        'days'             => $anomalyDays,
                    ],
                ],
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Failed to compute analytics.',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}
