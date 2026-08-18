<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $query = Expense::query()->orderByDesc('expense_date')->orderByDesc('id');

        if ($request->filled('start_date')) {
            $query->whereDate('expense_date', '>=', Carbon::parse($request->input('start_date'))->toDateString());
        }
        if ($request->filled('end_date')) {
            $query->whereDate('expense_date', '<=', Carbon::parse($request->input('end_date'))->toDateString());
        }

        $expenses = $query->get();

        return response()->json([
            'data'  => $expenses,
            'total' => round((float) $expenses->sum('amount'), 2),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'description'  => 'required|string|max:255',
            'category'     => 'nullable|string|max:100',
            'amount'       => 'required|numeric|min:0',
            'currency'     => 'nullable|string|max:10',
            'expense_date' => 'nullable|date',
        ]);

        $expense = Expense::create([
            'user_id'      => $request->user()->id ?? null,
            'description'  => $validated['description'],
            'category'     => $validated['category'] ?? null,
            'amount'       => $validated['amount'],
            'currency'     => $validated['currency'] ?? 'TZS',
            'expense_date' => $validated['expense_date'] ?? now()->toDateString(),
        ]);

        return response()->json([
            'message' => 'Expense recorded successfully.',
            'data'    => $expense,
        ], 201);
    }

    public function destroy(int $id)
    {
        $expense = Expense::find($id);

        if (!$expense) {
            return response()->json(['message' => 'Expense not found.'], 404);
        }

        $expense->delete();

        return response()->json(['message' => 'Expense deleted.']);
    }
}
