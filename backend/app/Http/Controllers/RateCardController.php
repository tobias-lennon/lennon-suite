<?php

namespace App\Http\Controllers;

use App\Models\RateCard;
use Illuminate\Http\JsonResponse;

class RateCardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            RateCard::where('is_active', true)->orderBy('id')->get()
        );
    }
}
