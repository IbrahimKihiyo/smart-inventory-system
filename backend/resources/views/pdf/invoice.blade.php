<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{ __('report.title') }}</title>
    <style>
        /* Base Reset & Typography */
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 14px;
            color: #374151; /* Tailwind gray-700 */
            line-height: 1.5;
            margin: 0;
            padding: 20px;
        }

        /* Header Layout (Table used for PDF compatibility) */
        .header-table {
            width: 100%;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb; /* Brand Blue */
            padding-bottom: 15px;
        }

        .header-table td {
            vertical-align: middle;
        }

        h1 {
            font-size: 24px;
            color: #111827; /* Tailwind gray-900 */
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .report-meta {
            text-align: right;
            font-size: 13px;
            color: #6b7280; /* Tailwind gray-500 */
        }

        .report-meta strong {
            color: #374151;
        }

        /* Main Data Table */
        .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }

        .data-table th {
            background-color: #f8fafc; /* Tailwind slate-50 */
            color: #475569; /* Tailwind slate-600 */
            text-transform: uppercase;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            padding: 12px 10px;
            text-align: left;
            border-bottom: 2px solid #cbd5e1;
        }

        .data-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #e2e8f0;
            color: #4b5563;
        }

        /* Striped Rows */
        .data-table tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }

        .data-table th.text-right,
        .data-table td.text-right {
            text-align: right;
        }

        .data-table th.text-center,
        .data-table td.text-center {
            text-align: center;
        }

        /* Emphasize the Profit Column */
        .profit-cell {
            font-weight: 600;
            color: #059669; /* Tailwind emerald-600 */
        }

        /* Summary Section */
        .summary-container {
            width: 100%;
        }

        .summary-box {
            float: right;
            width: 320px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 15px 20px;
        }

        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }

        .summary-table td {
            padding: 8px 0;
            font-size: 14px;
            color: #475569;
        }

        .summary-table .total-row td {
            border-top: 2px solid #cbd5e1;
            padding-top: 12px;
            font-size: 16px;
            font-weight: bold;
            color: #111827;
        }

        .summary-table td.text-right {
            text-align: right;
        }

        /* Utilities */
        .no-data {
            text-align: center !important;
            padding: 60px 20px !important;
            color: #9ca3af !important;
            font-size: 16px;
            font-style: italic;
        }

        .clearfix {
            clear: both;
        }

        .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>

    <table class="header-table">
        <tr>
            <td>
                <h1>{{ __('report.title') }}</h1>
            </td>
            <td class="report-meta">
                <div><strong>{{ __('report.generated') }}</strong> {{ $dateTime }}</div>
                @if($startDate || $endDate)
                    <div>
                        <strong>{{ __('report.period') }}</strong>
                        {{ $startDate ?? __('report.period_start') }}
                        {{ __('report.period_to') }}
                        {{ $endDate ?? __('report.period_end') }}
                    </div>
                @else
                    <div><strong>{{ __('report.period') }}</strong> {{ __('report.period_all') }}</div>
                @endif
            </td>
        </tr>
    </table>

    <table class="data-table">
        <thead>
            <tr>
                <th class="text-center" style="width: 5%;">{{ __('report.column_index') }}</th>
                <th style="width: 35%;">{{ __('report.column_product') }}</th>
                <th class="text-right" style="width: 15%;">{{ __('report.column_buying') }}</th>
                <th class="text-center" style="width: 15%;">{{ __('report.column_qty') }}</th>
                <th class="text-right" style="width: 15%;">{{ __('report.column_selling') }}</th>
                <th class="text-right" style="width: 15%;">{{ __('report.column_profit') }}</th>
            </tr>
        </thead>
        <tbody>
            @forelse($report as $index => $item)
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td><strong>{{ $item->name }}</strong></td>
                    <td class="text-right">{{ number_format($item->buying_price, 2) }}</td>
                    <td class="text-center">{{ number_format($item->quantity_sold, 2) }}</td>
                    <td class="text-right">{{ number_format($item->selling_price, 2) }}</td>
                    <td class="text-right profit-cell">{{ number_format($item->profit, 2) }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="6" class="no-data">
                        {{ __('report.no_data') }}
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="summary-container">
        <div class="summary-box">
            @if($report->isNotEmpty())
                <table class="summary-table">
                    <tr>
                        <td>{{ __('report.total_items') }}</td>
                        <td class="text-right">{{ number_format($totalItemsSold, 2) }}</td>
                    </tr>
                    <tr class="total-row">
                        <td>{{ __('report.total_profit') }}</td>
                        <td class="text-right profit-cell">{{ number_format($totalProfit, 2) }}</td>
                    </tr>
                </table>
            @else
                <div style="text-align:center; padding:10px 0; color:#6b7280;">
                    {{ __('report.no_summary') }}
                </div>
            @endif
        </div>
    </div>

    <div class="clearfix"></div>

    <div class="footer">
        {{ __('report.footer') }}
    </div>

</body>
</html>