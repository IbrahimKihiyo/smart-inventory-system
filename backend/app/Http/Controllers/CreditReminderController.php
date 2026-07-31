<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\Carbon;

/**
 * Credit reminder module (FR10).
 *
 * Automatically finds credit sales whose payment is overdue, or due within a
 * threshold (default 3 days), so the app can remind the shop owner to follow
 * up on outstanding debts before they turn into bad debt.
 */
class CreditReminderController extends Controller
{
    /**
     * Default look-ahead window (days) for "due soon".
     */
    private const DEFAULT_DAYS = 3;

    /**
     * GET /api/credit-reminders?days=3
     */
    public function index(Request $request): JsonResponse
    {
        $days = (int) $request->input('days', self::DEFAULT_DAYS);
        $days = max(1, min(90, $days));

        $now       = Carbon::now();
        $soonLimit = $now->copy()->addDays($days)->endOfDay();
        $today     = $now->copy()->startOfDay();

        // Only unpaid credit sales that have a due date
        $base = Transaction::query()
            ->where('payment_method', 'CREDIT')
            ->where('status', '!=', 'COMPLETED')
            ->whereNotNull('pay_before');

        // Overdue: due date has already passed
        $overdue = (clone $base)
            ->where('pay_before', '<', $now)
            ->orderBy('pay_before', 'asc')
            ->get()
            ->map(fn ($t) => $this->formatCredit($t, $today));

        // Due soon: due date is within the threshold
        $dueSoon = (clone $base)
            ->where('pay_before', '>=', $now)
            ->where('pay_before', '<=', $soonLimit)
            ->orderBy('pay_before', 'asc')
            ->get()
            ->map(fn ($t) => $this->formatCredit($t, $today));

        return response()->json([
            'threshold_days'  => $days,
            'overdue_count'   => $overdue->count(),
            'due_soon_count'  => $dueSoon->count(),
            'overdue'         => $overdue->values(),
            'due_soon'        => $dueSoon->values(),
        ], 200);
    }

    /**
     * Shape a credit transaction for the reminder list, with a signed day
     * count: negative = days overdue, 0 = due today, positive = days until due.
     */
    private function formatCredit(Transaction $t, Carbon $today): array
    {
        $dueDay = Carbon::parse($t->pay_before)->startOfDay();

        return [
            'id'             => $t->id,
            'borrower_name'  => $t->borrower_name,
            'borrower_phone' => $t->borrower_phone,
            'amount'         => $t->amount,
            'currency'       => $t->currency,
            'pay_before'     => Carbon::parse($t->pay_before)->toDateTimeString(),
            'days_diff'      => $today->diffInDays($dueDay, false),
        ];
    }
}
