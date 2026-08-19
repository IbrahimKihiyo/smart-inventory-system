<?php
// routes/api.php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\TenantRegistrationController;
use App\Http\Controllers\PawaPayController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\TransactionItemController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CreditTransactionController;
use App\Http\Controllers\CashTransactionController;
use App\Http\Controllers\MobileTransactionController;
use App\Http\Controllers\CreditorController;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\PurchasePriceController;
use App\Http\Controllers\ExpiryAlertController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\CreditReminderController;
use App\Http\Controllers\AnalyticsController;

// ─── Public: Tenant Registration (no tenant context needed) ──────────────────
Route::post('/tenants/register', [TenantRegistrationController::class, 'register'])
    ->middleware('throttle:10,10');
Route::post('/pawapay/mobile_payment_callback', [PawaPayController::class, 'mobilePaymentCallback']);

// ─── Tenant Routes (require X-Tenant header) ─────────────────────────────────
Route::middleware(['tenant'])->group(function () {

    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:20,10');
    Route::post('/login',    [AuthController::class, 'login'])->middleware('throttle:30,1');

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/user',    [AuthController::class, 'user']);

        Route::get('/dashboard/metrics', [DashboardController::class, 'getMetrics']);

        // Smart analytics: demand forecast, reorder point, anomaly detection
        Route::get('/analytics/insights', [AnalyticsController::class, 'insights']);

        // Categories
        Route::get('/categories',              [CategoryController::class, 'index']);
        Route::post('/categories',             [CategoryController::class, 'store']);
        Route::put('/categories/{category}',   [CategoryController::class, 'update']);
        Route::delete('/categories/{category}',[CategoryController::class, 'destroy']);

        // Expiry alerts (FR06) — declared before /products/{...} bindings
        Route::get('/products/expiry-alerts', [ExpiryAlertController::class, 'index']);

        // Products
        Route::get('/products',               [ProductController::class, 'index']);
        Route::post('/products',              [ProductController::class, 'store']);
        Route::put('/products/{product}',     [ProductController::class, 'update']);
        Route::delete('/products/{id}',       [ProductController::class, 'destroy']);

        // Purchase price history & Buying Advisor (FR12 & FR13)
        Route::get('/products/{product}/purchases',  [PurchasePriceController::class, 'index']);
        Route::post('/products/{product}/purchases', [PurchasePriceController::class, 'store']);
        Route::get('/purchase-recommendations',      [PurchasePriceController::class, 'recommendations']);
        Route::post('/purchase-check',               [PurchasePriceController::class, 'check']);

        Route::get('/pawapay/availability', [PawaPayController::class, 'providerAvailability']);
        Route::post('/pawapay/mobile_initialize_deposit', [PawaPayController::class, 'mobileInitializeDeposit']);
        Route::get('/pawapay/deposit-status/{depositId}', [PawaPayController::class, 'checkDepositStatus']);

        Route::post('/transactions/cash', [CashTransactionController::class, 'store']);
        Route::post('/transactions/mobile', [MobileTransactionController::class, 'store']);

        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);
        Route::post('/transactions/credit', [CreditTransactionController::class, 'store']);
        Route::patch('/transactions/credit/{id}/repay', [CreditTransactionController::class, 'repay']);


        Route::get('/transactions', [TransactionController::class, 'index']);
        Route::get('/transactions/{id}', [TransactionController::class, 'show']);
        Route::get('/exchange-rate', [TransactionController::class, 'convertCurrency']);

        Route::get('/creditors', [CreditorController::class, 'index']);
        Route::get('/credit-reminders', [CreditReminderController::class, 'index']);
        Route::get('/invoice/pdf', [PdfController::class, 'generateInvoice']);


    });
});
