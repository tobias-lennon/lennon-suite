<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private GeocodingService $geocoding) {}

    public function show(): JsonResponse
    {
        return response()->json(CompanySetting::instance());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name'            => 'sometimes|string|max:255',
            'company_email'           => 'nullable|email|max:255',
            'company_phone'           => 'nullable|string|max:30',
            'vat_number'              => 'nullable|string|max:50',
            'address_line_1'          => 'nullable|string|max:255',
            'address_line_2'          => 'nullable|string|max:255',
            'city'                    => 'nullable|string|max:100',
            'county'                  => 'nullable|string|max:100',
            'eircode'                 => 'nullable|string|max:10',
            'vat_rate'                => 'sometimes|numeric|min:0|max:100',
            'invoice_due_days'        => 'sometimes|integer|min:1|max:365',
            'invoice_prefix'          => 'sometimes|string|max:10',
            'loyalty_threshold_hours' => 'sometimes|integer|min:1',
            'target_billable_days'    => 'sometimes|integer|min:1|max:366',
        ]);

        $settings = CompanySetting::instance();
        $oldEircode = $settings->eircode;
        $settings->update($data);

        $newEircode = $settings->fresh()->eircode;
        if ($newEircode && $newEircode !== $oldEircode) {
            $coords = $this->geocoding->geocodeEircode($newEircode);
            if ($coords) {
                $settings->update(['hq_latitude' => $coords['latitude'], 'hq_longitude' => $coords['longitude']]);
            }
        }

        return response()->json($settings->fresh());
    }
}
