<?php

namespace App\Http\Controllers;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Spatie\Browsershot\Browsershot;
use App\Models\TransactionItem;

class PdfController extends Controller
{
    /**
     * Languages the report can be produced in.
     */
    private const SUPPORTED_LOCALES = ['en', 'sw'];

  public function generateInvoice(Request $request)
{
    // The application sends the language the user is currently reading, so the
    // report comes out in the same language as the rest of the screens.
    $locale = $request->input('lang');

    App::setLocale(in_array($locale, self::SUPPORTED_LOCALES, true) ? $locale : 'en');

    $query = TransactionItem::join('products', 'products.id', '=', 'transaction_items.product_id')
        ->join('transactions', 'transactions.id', '=', 'transaction_items.transaction_id')
        ->where('transactions.status', 'COMPLETED');

    // Filter by date range
    if ($request->filled('start_date') && $request->filled('end_date')) {
        $query->whereBetween('transactions.created_at', [
            Carbon::parse($request->start_date)->startOfDay(),
            Carbon::parse($request->end_date)->endOfDay(),
        ]);
    } elseif ($request->filled('start_date')) {
        $query->where('transactions.created_at', '>=',
            Carbon::parse($request->start_date)->startOfDay()
        );
    } elseif ($request->filled('end_date')) {
        $query->where('transactions.created_at', '<=',
            Carbon::parse($request->end_date)->endOfDay()
        );
    }

    $report = $query
        ->selectRaw("
            products.id,
            products.name,
            products.buying_price,
            products.price AS selling_price,
            SUM(transaction_items.quantity) AS quantity_sold,
            SUM((transaction_items.unit_price - products.buying_price) * transaction_items.quantity) AS profit
        ")
        ->groupBy(
            'products.id',
            'products.name',
            'products.buying_price',
            'products.price'
        )
        ->get();

    $totalItemsSold = $report->sum('quantity_sold');
    $totalProfit = $report->sum('profit');

    $html = view('pdf.invoice', [
        'report' => $report,
        'totalItemsSold' => $totalItemsSold,
        'totalProfit' => $totalProfit,
        'dateTime' => now()->format('d M Y H:i:s'),

        // send selected range to Blade
        'startDate' => $request->filled('start_date')
            ? Carbon::parse($request->start_date)->format('d M Y')
            : null,

        'endDate' => $request->filled('end_date')
            ? Carbon::parse($request->end_date)->format('d M Y')
            : null,
    ])->render();

    try {
        $browsershot = Browsershot::html($html)
            ->noSandbox()
            ->format('A4')
            ->showBackground()
            ->margins(10, 10, 10, 10);

        if ($chromePath = $this->resolveChromePath()) {
            $browsershot->setChromePath($chromePath);
        }

        $pdf = $browsershot->pdf();
    } catch (\Throwable $e) {
        return response()->json([
            'message' => 'The report could not be generated. A Chrome or Edge installation is required to render the PDF.',
            'error'   => $e->getMessage(),
        ], 500);
    }

    return response($pdf)
        ->header('Content-Type','application/pdf')
        ->header('Content-Disposition','inline; filename="Sales_Report.pdf"');
}

    /**
     * Locate the browser used to render the PDF.
     *
     * The path can be set with CHROME_PATH in the environment file. When it is
     * not set, or points at a file that is not there, the usual installation
     * directories are checked instead, so the report keeps working on another
     * machine without any configuration being changed.
     */
    private function resolveChromePath(): ?string
    {
        $configured = config('services.chrome.path');

        if ($configured && is_file($configured)) {
            return $configured;
        }

        $localAppData = getenv('LOCALAPPDATA');

        $candidates = [
            'C:\Program Files\Google\Chrome\Application\chrome.exe',
            'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
            $localAppData ? $localAppData . '\Google\Chrome\Application\chrome.exe' : null,
            'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
            'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
        ];

        foreach ($candidates as $candidate) {
            if ($candidate && is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}