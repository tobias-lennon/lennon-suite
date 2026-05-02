<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Models\Customer;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
    public function __construct(private WeatherService $weather) {}

    public function hq(): JsonResponse
    {
        $settings = CompanySetting::instance();

        if (!$settings->hq_latitude || !$settings->hq_longitude) {
            return response()->json(['error' => 'HQ coordinates not set. Save the company eircode in Settings to enable weather.'], 422);
        }

        $forecasts = $this->weather->getForecast(
            (float) $settings->hq_latitude,
            (float) $settings->hq_longitude,
        );

        return response()->json([
            'location'  => $settings->city ?? 'HQ',
            'forecasts' => $forecasts,
        ]);
    }

    public function forCustomer(Request $request, Customer $customer): JsonResponse
    {
        if (!$customer->latitude || !$customer->longitude) {
            return response()->json(['error' => 'No coordinates for this customer.'], 422);
        }

        $forecasts = $this->weather->getForecast(
            (float) $customer->latitude,
            (float) $customer->longitude,
        );

        return response()->json([
            'location'  => $customer->name,
            'forecasts' => $forecasts,
        ]);
    }
}
