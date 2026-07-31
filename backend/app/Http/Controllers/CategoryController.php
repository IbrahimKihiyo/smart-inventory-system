<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class CategoryController extends Controller
{
    /**
     * Display a listing of the categories.
     */
    public function index(): JsonResponse
    {
        // Fetch categories ordered alphabetically for the mobile dropdown menu
        $categories = Category::select('id', 'name')
            ->orderBy('name', 'asc')
            ->get();

        return response()->json($categories, 200);
    }

    /**
     * Store a newly created category in storage.
     */
    public function store(Request $request): JsonResponse
    {
        // Matches $table->string('name', 100); limits from migration schema
        $validated = $request->validate([
            // Explicitly forces the validation unique check to look at the 'tenant' connection
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('tenant.categories', 'name')
            ],
        ]);

        $category = Category::create($validated);

        return response()->json([
            'message' => 'Category created successfully.',
            'data' => $category
        ], 201);
    }


    /**
     * Update the specified category in storage.
     */
    public function update(Request $request, Category $category): JsonResponse
    {
        // The unique rule ignores the current category ID so it doesn't fail if you don't change the name
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('tenant.categories', 'name')->ignore($category->id)
            ],
        ]);

        $category->update($validated);

        // Returning the direct object matches your React Native 'onCategoryUpdated(response.data)' structure
        return response()->json($category, 200);
    }

    /**
     * Remove the specified category from storage.
     */
    public function destroy(Category $category): JsonResponse
    {
        // Safety Check: Check if this category is attached to any existing products
        // This assumes you have a 'products' relationship defined in your Category Model
        if ($category->products()->exists()) {
            return response()->json([
                'message' => 'Cannot delete category. There are products actively assigned to it.'
            ], 422);
        }

        $category->delete();

        return response()->json([
            'message' => 'Category deleted successfully.'
        ], 200);
    }
}
