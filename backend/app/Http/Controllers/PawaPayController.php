<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\Product; // ✅ Imported the Product model

class PawaPayController extends Controller
{
    /**
     * Format Tanzanian Phone Number
     */
    private function formatTzPhone(?string $number): ?string
    {
        if (!$number) {
            return $number;
        }

        // Remove spaces and non-digits
        $number = preg_replace('/\D/', '', $number);

        if (str_starts_with($number, "255")) {
            return $number;
        } elseif (str_starts_with($number, "0")) {
            return "255" . substr($number, 1);
        } elseif (str_starts_with($number, "7") && strlen($number) === 9) {
            return "255" . $number;
        }

        return $number; // fallback
    }

    /**
     * Initialize Mobile Deposit
     */
    public function mobileInitializeDeposit(Request $request)
    {
        $token = env('PAWAPAY_TOKEN');
        $baseUrl = env('PAWAPAY_DEPOSIT_BASE_URL');

        try {
            // 🔴 Validation
            $validated = $request->validate([
                'mobileNumber'         => 'required|string',
                'amount'               => 'required|numeric',
                'provider'             => 'required|string',
                'currency'             => 'required|string',
                'items'                => 'required|array|min:1',
                'items.*.product_id'   => 'required|integer',
                'items.*.quantity'     => 'required|numeric|min:0',
                'items.*.unit_price'   => 'required|numeric',
                'items.*.subtotal'     => 'required|numeric',
            ]);

            $user = $request->user();

            // ✅ Convert phone number
            $mobileNumber = $this->formatTzPhone($validated['mobileNumber']);

            // 🔑 Generate unique IDs
            $depositId = (string) Str::uuid();
            $orderId = (string) Str::uuid();

            // 🧾 Build payload
            $payload = [
                "depositId" => $depositId,
                "payer" => [
                    "type" => "MMO",
                    "accountDetails" => [
                        "phoneNumber" => $mobileNumber,
                        "provider" => $validated['provider']
                    ]
                ],
                "amount" => (string) $validated['amount'],
                "currency" => $validated['currency'],
                "clientReferenceId" => "CLIRF-" . substr($depositId, 0, 8),
                "customerMessage" => "Payment request",
                "metadata" => [
                    ["orderId" => "ORD-{$orderId}"],
                    ["userId" => $user->id]
                ]
            ];

            // 💾 DB Transaction
            DB::transaction(function () use ($user, $validated, $orderId, $depositId, $mobileNumber) {
                // 1. Create Transaction
                $transaction = Transaction::create([
                    'user_id'               => $user->id,
                    'payment_method'        => 'MOBILE_MONEY',
                    'provider'              => 'PAWAPAY',
                    'status'                => 'PENDING',
                    'amount'                => $validated['amount'],
                    'currency'              => $validated['currency'],
                    'internal_reference_id' => $orderId,
                    'external_reference_id' => $depositId,
                    'payer_phone'           => $mobileNumber,
                    'mmo_provider'          => $validated['provider'],
                ]);

                // 2. Create Items via Eloquent (Ensures it writes to the correct Tenant DB)
                foreach ($validated['items'] as $item) {
                    // Apply ceil() to round up to the next integer
                    $unitPrice = ceil((float)$item['unit_price']);

                    // Recalculate subtotal based on the new rounded unit price
                    // This ensures consistency in your database
                    $subtotal = $unitPrice * $item['quantity'];
                    $subTotal = ceil($subtotal); // Round up subtotal as well

                    TransactionItem::create([
                        'transaction_id' => $transaction->id,
                        'product_id'     => $item['product_id'],
                        'quantity'       => $item['quantity'],
                        'unit_price'     => $unitPrice,
                        'subtotal'       => $subTotal,
                    ]);
                }
            });

            // 🚀 Send Request
            $response = Http::withToken($token)
                ->acceptJson()
                ->post($baseUrl, $payload);

            $responseData = $response->json() ?? $response->body();

            if ($response->successful()) {
                Log::info("PawaPay Response:", (array)$responseData);

                return response()->json([
                    "success" => true,
                    "message" => "Deposit Request Sent",
                    "data"    => $responseData
                ], 200);
            } else {
                Log::error("PawaPay Error Response:", (array)$responseData);

                return response()->json([
                    "success" => false,
                    "message" => "pawaPay error",
                    "data"    => $responseData
                ], $response->status());
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
             return response()->json([
                "error" => "Missing or invalid required fields",
                "details" => $e->errors()
            ], 400);
        } catch (\Exception $e) {
            Log::error("Server Error: " . $e->getMessage());

            return response()->json([
                "success" => false,
                "message" => "Server error",
                "error"   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mobile Payment Callback
     */
    public function mobilePaymentCallback(Request $request)
    {
        try {
            $data      = $request->all();
            $depositId = $request->input('depositId');
            $status    = $request->input('status'); // e.g., 'COMPLETED', 'FAILED'
            $providerTransactionId = $request->input('providerTransactionId');

            Log::info("PawaPay Callback Received:\n" . json_encode($data, JSON_PRETTY_PRINT));

            if (!$depositId) {
                return response()->json(['error' => 'Missing depositId'], 400);
            }

            // Find which tenant owns this depositId
            $tenant = $this->resolveTenantForDeposit($depositId);

            if (!$tenant) {
                Log::error("PawaPay Callback: No tenant found for depositId {$depositId}");
                return response()->json(['message' => 'Tenant not found, callback acknowledged'], 200);
            }

            // Switch to the tenant's schema
            $this->switchToTenantSchema($tenant->database);

            // 1. Fetch current transaction record before modifying (Idempotency validation)
            $transaction = DB::connection('tenant')
                ->table('transactions')
                ->where('external_reference_id', $depositId)
                ->first();

            if ($transaction) {
                // Check if this callback transitions the status to COMPLETED for the very first time
                $isNewlyCompleted = ($status === 'COMPLETED' && $transaction->status !== 'COMPLETED');

                // 2. Update the transaction in the correct tenant schema
                DB::connection('tenant')
                    ->table('transactions')
                    ->where('id', $transaction->id)
                    ->update([
                        'status'                  => $status,
                        'provider_transaction_id' => $providerTransactionId,
                        'raw_payload'             => json_encode($data),
                        'updated_at'              => now(),
                    ]);

                // 3. ✅ Deduct stock if payment was just completed successfully
                if ($isNewlyCompleted) {
                    $items = DB::connection('tenant')
                        ->table('transaction_items')
                        ->where('transaction_id', $transaction->id)
                        ->get();

                    foreach ($items as $item) {
                        // Safe decrement running against the selected tenant connection path
                        DB::connection('tenant')
                            ->table('products')
                            ->where('id', $item->product_id)
                            ->decrement('stock', $item->quantity);

                        Log::info("Inventory updated: Decremented product ID {$item->product_id} stock by {$item->quantity} for schema {$tenant->database}");
                    }
                }
            } else {
                Log::warning("PawaPay Callback: Transaction record not found for external_reference_id {$depositId} in schema {$tenant->database}");
            }

            // Reset schema back to public
            $this->switchToTenantSchema('public');

            Log::info("PawaPay Callback: Updated transaction for depositId {$depositId} in schema {$tenant->database}");

            return response()->json(['message' => 'Callback received successfully'], 200);

        } catch (\Exception $e) {
            Log::error("Callback Error: " . $e->getMessage());

            // Always return 200 to prevent PawaPay from retrying endlessly if an app exception pops up
            return response()->json(['message' => 'Callback acknowledged', 'error' => $e->getMessage()], 200);
        }
    }

    /**
     * Search all tenant schemas for the given depositId.
     * Returns the matching Tenant model or null.
     */
    private function resolveTenantForDeposit(string $depositId): ?\App\Models\Tenant
    {
        $tenants = \App\Models\Tenant::all();

        foreach ($tenants as $tenant) {
            try {
                $this->switchToTenantSchema($tenant->database);

                $exists = DB::connection('tenant')
                    ->table('transactions')
                    ->where('external_reference_id', $depositId)
                    ->exists();

                if ($exists) {
                    return $tenant;
                }
            } catch (\Exception $e) {
                Log::warning("Could not check schema {$tenant->database}: " . $e->getMessage());
            }
        }

        $this->switchToTenantSchema('public');
        return null;
    }

    /**
     * Switch the tenant DB connection to the given PostgreSQL schema.
     */
    private function switchToTenantSchema(string $schema): void
    {
        config([
            'database.connections.tenant.search_path' => "\"{$schema}\"",
            'database.connections.tenant.schema'      => $schema,
        ]);

        \Illuminate\Support\Facades\DB::purge('tenant');
        \Illuminate\Support\Facades\DB::connection('tenant')
            ->statement("SET search_path TO \"{$schema}\"");
    }

    /**
     * Check Deposit Status
     */
    public function checkDepositStatus(Request $request, $depositId)
    {
        $token = env('PAWAPAY_TOKEN');
        $baseUrl = env('PAWAPAY_DEPOSIT_BASE_URL');

        try {
            if (!$depositId) {
                return response()->json([
                    "success" => false,
                    "message" => "depositId is required"
                ], 400);
            }

            $url = "{$baseUrl}/{$depositId}";

            $response = Http::withToken($token)->get($url);
            $data = $response->json() ?? $response->body();

            if ($response->successful()) {


                return response()->json([
                    "success" => true,
                    "message" => "Deposit status fetched",
                    "data"    => $data
                ], 200);
            }

            return response()->json([
                "success" => false,
                "message" => "Failed to fetch deposit status",
                "data"    => $data
            ], $response->status());

        } catch (\Exception $e) {
            return response()->json([
                "success" => false,
                "message" => "Server error",
                "error"   => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Provider Availability
     */
    public function providerAvailability(Request $request)
    {
        $token = env('PAWAPAY_TOKEN');
        $baseUrl = env('PAWAPAY_BASE_URL');

        $country = $request->query('country', '');
        $operationType = $request->query('operationType', 'DEPOSIT');

        $url = "{$baseUrl}/v2/availability";

        try {
            $response = Http::withToken($token)->get($url, [
                'country'       => $country,
                'operationType' => $operationType
            ]);

            if ($response->failed()) {
                $response->throw();
            }

            return response()->json($response->json(), 200);

        } catch (\Exception $e) {
            return response()->json(["error" => $e->getMessage()]);
        }
    }
}
