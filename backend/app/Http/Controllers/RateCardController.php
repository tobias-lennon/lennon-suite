<?php

namespace App\Http\Controllers;

use App\Models\RateCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RateCardController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            RateCard::where('is_active', true)->orderBy('id')->get()
        );
    }

    public function update(Request $request, RateCard $rateCard): JsonResponse
    {
        $data = $request->validate([
            'name'                    => 'sometimes|string|max:255',
            'base_rate'               => 'sometimes|numeric|min:0',
            'power_tool_uplift'       => 'sometimes|numeric|min:0',
            'waste_uplift'            => 'sometimes|numeric|min:0',
            'maintenance_rate'        => 'sometimes|numeric|min:0',
            'callout_fee'             => 'sometimes|numeric|min:0',
            'callout_threshold_hours' => 'sometimes|numeric|min:0',
        ]);

        $rateCard->update($data);
        return response()->json($rateCard->fresh());
    }
}
