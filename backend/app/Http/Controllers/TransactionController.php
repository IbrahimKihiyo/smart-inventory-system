<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Exception;

class TransactionController extends Controller
{

    /**
     * Fetch all transactions
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Transaction::query()
            ->orderBy('created_at', 'desc');


        if ($user->role !== 'admin') {

            $query->where(
                'user_id',
                $user->id
            );

        }


        $transactions = $query->get();


        return response()->json(
            $transactions,
            200
        );
    }




    /**
     * Show single transaction
     */
    public function show($id, Request $request): JsonResponse
    {

        $user = $request->user();


        $query = Transaction::query()
            ->with([
                'items.product'
            ]);


        if ($user->role !== 'admin') {

            $query->where(
                'user_id',
                $user->id
            );

        }


        $transaction = $query->findOrFail($id);



        return response()->json(
            $transaction,
            200
        );
    }






    /**
     * Currency conversion
     */
    public function convertCurrency(Request $request): JsonResponse
    {

        $validated = $request->validate([

            'from'   => 'required|string|size:3',

            'to'     => 'required|string|size:3',

            'amount' => 'required|numeric|min:0',

        ]);



        $apiKey = env('EXCONVERT_API_KEY');


        try {


            $response = Http::timeout(10)
                ->get(
                    'https://api.exconvert.com/convert',
                    [

                        'access_key'=>$apiKey,

                        'from'=>strtoupper($validated['from']),

                        'to'=>strtoupper($validated['to']),

                        'amount'=>$validated['amount']

                    ]
                );



            if($response->failed()){


                return response()->json([

                    'message'=>'Currency provider failed'

                ],502);

            }



            $data = $response->json();


            $target = strtoupper($validated['to']);



            if(!isset($data['result'][$target])){


                return response()->json([

                    'message'=>'Invalid conversion result'

                ],500);

            }



            return response()->json([

                'success'=>true,

                'from'=>strtoupper($validated['from']),

                'to'=>$target,

                'original_amount'=>$validated['amount'],

                'converted_amount'=>$data['result'][$target]


            ]);



        }catch(Exception $e){


            return response()->json([

                'message'=>$e->getMessage()

            ],500);

        }

    }








    /**
     * Calculate profit
     */
    public function profitCalculator(Request $request): JsonResponse
    {

        $profitPerProduct = TransactionItem::join('products', 'products.id', '=', 'transaction_items.product_id')
            ->selectRaw('
                products.id,
                products.name,
                SUM((transaction_items.unit_price - products.buying_price) * transaction_items.quantity) as profit
            ')
            ->groupBy('products.id', 'products.name')
            ->get();

        echo $profitPerProduct;


        return response()->json([
            'status'=>'success',
            'profit'=>(float)$profitPerProduct


        ]);

    }

}