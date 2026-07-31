<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

/**
 * Expiry detection module (FR06).
 *
 * Automatically checks product expiry dates and returns the goods that are
 * already expired or that will expire within a threshold (default 7 days),
 * so the mobile app can alert the shop owner and prevent selling expired
 * stock. Only products that still have stock on hand are reported.
 */
class ExpiryAlertController extends Controller
{
    /**
     * Default number of days ahead that counts as "expiring soon".
     */
    private const DEFAULT_DAYS = 7;

    /**
     * GET /api/products/expiry-alerts?days=7
     */
    public function index(Request $request): JsonResponse
    {
        // Clamp the look-ahead window to a sensible range (1–90 days)
        $days = (int) $request->input('days', self::DEFAULT_DAYS);
        $days = max(1, min(90, $days));

        $now       = Carbon::now();
        $soonLimit = $now->copy()->addDays($days)->endOfDay();
        $today     = $now->copy()->startOfDay();

        // Only alert on goods we actually still have in stock
        $base = Product::query()
            ->whereNotNull('expiry_date')
            ->where('stock', '>', 0);

        // Already expired: expiry date is in the past
        $expired = (clone $base)
            ->where('expiry_date', '<=', $now)
            ->orderBy('expiry_date', 'asc')
            ->get()
            ->map(fn ($p) => $this->formatProduct($p, $today));

        // Expiring soon: expiry date is between now and the threshold
        $expiringSoon = (clone $base)
            ->where('expiry_date', '>', $now)
            ->where('expiry_date', '<=', $soonLimit)
            ->orderBy('expiry_date', 'asc')
            ->get()
            ->map(fn ($p) => $this->formatProduct($p, $today));

        return response()->json([
            'threshold_days'      => $days,
            'expired_count'       => $expired->count(),
            'expiring_soon_count' => $expiringSoon->count(),
            'expired'             => $expired->values(),
            'expiring_soon'       => $expiringSoon->values(),
        ], 200);
    }

    /**
     * Shape a product for the alert list, including a signed day count:
     * positive = days remaining, 0 = today, negative = days since expiry.
     */
    private function formatProduct(Product $product, Carbon $today): array
    {
        $expiryDay = $product->expiry_date->copy()->startOfDay();

        return [
            'id'          => $product->id,
            'name'        => $product->name,
            'sku'         => $product->sku,
            'unit'        => $product->unit,
            'stock'       => $product->stock,
            'expiry_date' => $product->expiry_date->toDateTimeString(),
            'days_diff'   => $today->diffInDays($expiryDay, false),
        ];
    }
}
