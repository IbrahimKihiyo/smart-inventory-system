<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\PurchasePrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

/**
 * Handles the product purchase-price history (FR12) and the buying
 * recommendation engine (FR13).
 *
 * FR12: store historical purchase prices for each product.
 * FR13: recommend restocking when the current market price is lower than
 *       the average of the last three purchase prices.
 */
class PurchasePriceController extends Controller
{
    /**
     * Number of most recent purchases used to build the average benchmark.
     */
    private const SAMPLE_SIZE = 3;

    /**
     * List the purchase-price history for a single product (newest first).
     *
     * GET /api/products/{product}/purchases
     */
    public function index(Product $product): JsonResponse
    {
        $history = $product->purchasePrices()
            ->orderByDesc('purchased_at')
            ->orderByDesc('id')
            ->get();

        return response()->json($history, 200);
    }

    /**
     * Record a new purchase for a product.
     *
     * This does two things in one step (the user-friendly flow):
     *   1. Saves the price paid into the purchase-price history (FR12).
     *   2. Adds the quantity bought to the product's current stock.
     *
     * POST /api/products/{product}/purchases
     */
    public function store(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'price'        => 'required|numeric|min:0',
            'currency'     => 'nullable|string|max:5',
            'quantity'     => 'required|numeric|min:0',
            'note'         => 'nullable|string|max:255',
            'purchased_at' => 'nullable|date',
        ]);

        // If the product does not allow decimals, keep the added quantity whole
        $quantity = $product->allow_decimal
            ? (float) $validated['quantity']
            : floor((float) $validated['quantity']);

        $purchase = PurchasePrice::create([
            'product_id'   => $product->id,
            'price'        => $validated['price'],
            'currency'     => $validated['currency'] ?? $product->currency,
            'quantity'     => $quantity,
            'note'         => $validated['note'] ?? null,
            'purchased_at' => $validated['purchased_at'] ?? Carbon::now(),
        ]);

        // Top up the stock with the quantity just bought, and keep the
        // product's current buying price in sync with the latest purchase.
        $product->increment('stock', $quantity);
        $product->update(['buying_price' => $validated['price']]);

        return response()->json([
            'message'  => 'Purchase recorded and stock updated successfully.',
            'purchase' => $purchase,
            'product'  => $product->fresh()->load('category:id,name'),
        ], 201);
    }

    /**
     * Return the purchase-price benchmark for every product.
     *
     * For each product we expose:
     *   - purchase_count      : how many purchases have been recorded
     *   - average_last_three  : average of the last 3 purchase prices
     *   - latest_price        : the most recent purchase price
     *
     * The front-end Buying Advisor uses `average_last_three` as the benchmark
     * the shop owner compares today's market price against.
     *
     * GET /api/purchase-recommendations
     */
    public function recommendations(): JsonResponse
    {
        $products = Product::with('category:id,name')
            ->orderBy('name', 'asc')
            ->get();

        $data = $products->map(function ($product) {
            $recent = $product->purchasePrices()
                ->orderByDesc('purchased_at')
                ->orderByDesc('id')
                ->take(self::SAMPLE_SIZE)
                ->get();

            $count = $product->purchasePrices()->count();

            return [
                'product_id'         => $product->id,
                'name'               => $product->name,
                'currency'           => $product->currency,
                'unit'               => $product->unit,
                'purchase_count'     => $count,
                'average_last_three' => $recent->count() > 0
                    ? round($recent->avg('price'), 2)
                    : null,
                'latest_price'       => $recent->first()?->price,
                'has_enough_history' => $count >= self::SAMPLE_SIZE,
            ];
        });

        return response()->json($data, 200);
    }

    /**
     * The decision engine (FR13).
     *
     * Given a product and today's market price, decide whether it is a good
     * time to buy. The rule: BUY when the market price is BELOW the average of
     * the last three recorded purchase prices; otherwise WAIT.
     *
     * POST /api/purchase-check
     * Body: { "product_id": 1, "market_price": 4500 }
     */
    public function check(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id'   => ['required', 'integer', Rule::exists('tenant.products', 'id')],
            'market_price' => 'required|numeric|min:0',
        ]);

        $product = Product::findOrFail($validated['product_id']);

        // Take the last three purchases (newest first) as the benchmark
        $recent = $product->purchasePrices()
            ->orderByDesc('purchased_at')
            ->orderByDesc('id')
            ->take(self::SAMPLE_SIZE)
            ->get();

        // Not enough history to give honest advice yet
        if ($recent->count() < self::SAMPLE_SIZE) {
            return response()->json([
                'suggestion' => 'INSUFFICIENT_DATA',
                'message'    => 'Not enough history yet. Record at least '
                    . self::SAMPLE_SIZE . ' purchases to get a recommendation.',
                'purchase_count'     => $recent->count(),
                'average_last_three' => null,
                'market_price'       => (float) $validated['market_price'],
            ], 200);
        }

        $average     = round($recent->avg('price'), 2);
        $marketPrice = (float) $validated['market_price'];
        $difference  = round($average - $marketPrice, 2); // positive = cheaper than usual
        $percentDiff = $average > 0
            ? round(($difference / $average) * 100, 1)
            : 0;

        $isGoodTime = $marketPrice < $average;

        // Extra analysis to support the decision.
        $sellingPrice = (float) $product->price;
        $prices   = $recent->pluck('price')->map(fn ($p) => (float) $p);
        $minPrice = round($prices->min(), 2);
        $maxPrice = round($prices->max(), 2);

        // Trend from the oldest to the newest price in the sample.
        $newest = (float) $recent->first()->price;
        $oldest = (float) $recent->last()->price;
        $trend  = abs($newest - $oldest) < ($average * 0.02)
            ? 'STABLE'
            : ($newest > $oldest ? 'RISING' : 'FALLING');

        // Keep at least a 20% profit margin on the current selling price.
        $recommendedMax = $sellingPrice > 0 ? round($sellingPrice * 0.8, 2) : null;

        // The profit margin the owner would keep if buying at today's price.
        $marginAtMarket = $sellingPrice > 0
            ? round((($sellingPrice - $marketPrice) / $sellingPrice) * 100, 1)
            : null;

        $warning = null;
        if ($sellingPrice > 0 && $marketPrice >= $sellingPrice) {
            $warning = 'LOSS';
        } elseif ($recommendedMax !== null && $marketPrice > $recommendedMax) {
            $warning = 'THIN';
        }

        return response()->json([
            'suggestion' => $isGoodTime ? 'BUY' : 'WAIT',
            'message'    => $isGoodTime
                ? 'Good time to buy. The market price is below your recent average.'
                : 'Better to wait. The market price is at or above your recent average.',
            'market_price'           => $marketPrice,
            'average_last_three'     => $average,
            'difference'             => $difference,
            'percent_diff'           => $percentDiff,
            'currency'               => $product->currency,
            'sample_prices'          => $recent->pluck('price'),
            'selling_price'          => $sellingPrice,
            'min_price'              => $minPrice,
            'max_price'              => $maxPrice,
            'trend'                  => $trend,
            'recommended_max_price'  => $recommendedMax,
            'margin_at_market_price' => $marginAtMarket,
            'warning'                => $warning,
        ], 200);
    }
}
