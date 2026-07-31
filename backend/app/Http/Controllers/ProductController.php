<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    /**
     * Display a listing of the products.
     */
    public function index(): JsonResponse
    {
        $products = Product::with('category:id,name')
            ->orderBy('stock', 'desc')
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($product) {
                $product->image_url = $product->image
                    ? asset('storage/' . $product->image)
                    : null;
                return $product;
            });

        return response()->json($products, 200);
    }

    /**
     * Store a newly created product in storage.
    */

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'          => [
                'required',
                'string',
                'max:100',
                Rule::unique('tenant.products', 'name'),
            ],
                
            'category_id'   => [
                'nullable',
                'integer',
                Rule::exists('tenant.categories', 'id')
            ],
            'description'   => 'nullable|string',
            'price'         => 'required|numeric|min:0',
            'buying_price'  => 'required|numeric|min:0',
            'unit'          => 'nullable|string|max:20',
            'allow_decimal' => 'nullable|boolean',
            'stock'         => 'required|numeric|min:0',
            'currency'      => 'required|string|max:5',
            'expiry_date'   => 'nullable|date',
            'image'         => 'nullable|image|max:5120', // 5MB max
        ]);

        // Auto-generate SKU
        $sku = strtoupper(uniqid());

        // Handle image upload if present
        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('products', 'public');
        }

        // If allow_decimal is false, force stock to whole number
        $allowDecimal = filter_var($validated['allow_decimal'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $stock = $allowDecimal ? $validated['stock'] : floor($validated['stock']);

        $product = Product::create([
            'sku'           => $sku,
            'name'          => $validated['name'],
            'category_id'   => $validated['category_id'] ?? null,
            'image'         => $imagePath,
            'description'   => $validated['description'] ?? null,
            'price'         => $validated['price'],
            'buying_price'  => $validated['buying_price'],
            'unit'          => $validated['unit'] ?? 'pcs',
            'allow_decimal' => $allowDecimal,
            'stock'         => $stock,
            'currency'      => $validated['currency'],
            'expiry_date'   => $validated['expiry_date'] ?? null,
        ]);

        return response()->json([
            'message' => 'Product saved to inventory successfully.',
            'data' => $product->load('category:id,name')
        ], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'name'          => [
                'required',
                'string',
                'max:100',
                Rule::unique('tenant.products', 'name')->ignore($product->id),
            ],
            'category_id'   => [
                'nullable',
                'integer',
                Rule::exists('tenant.categories', 'id')
            ],
            'description'   => 'nullable|string',
            'price'         => 'required|numeric|min:0',
            'buying_price'  => 'required|numeric|min:0',
            'unit'          => 'nullable|string|max:20',
            'allow_decimal' => 'nullable|boolean',
            'stock'         => 'required|numeric|min:0',
            'currency'      => 'required|string|max:5',
            'expiry_date'   => 'nullable|date',
            'image'         => 'nullable|image|max:5120',
        ]);

        // Handle image replacement
        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $validated['image'] = $request->file('image')->store('products', 'public');
        }

        $allowDecimal = filter_var($validated['allow_decimal'] ?? $product->allow_decimal, FILTER_VALIDATE_BOOLEAN);
        $validated['allow_decimal'] = $allowDecimal;
        $validated['stock'] = $allowDecimal ? $validated['stock'] : floor($validated['stock']);

        $product->update($validated);

        return response()->json([
            'message' => 'Product updated successfully.',
            'data' => $product->fresh()->load('category:id,name')
        ], 200);
    }


    public function destroy($id): JsonResponse
    {
        try {
            // Locate product target or fail explicitly with clean error handling
            $product = Product::findOrFail($id);

            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }

            // Delete record execution
            $product->delete();

            return response()->json([
                'success' => true,
                'message' => 'Product removed from stock successfully.'
            ], 200);

        } catch (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'The selected product does not exist or has already been deleted.'
            ], 404);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Internal server processing failure.'
            ], 500);
        }
    }
}
