<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeocodingService
{
    public function geocodeEircode(string $eircode): ?array
    {
        $clean = strtoupper(preg_replace('/[^A-Za-z0-9 ]/', '', trim($eircode)));
        if (!$clean) return null;

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'LennonLandscapingSuite/1.0 (lennonlandscaping.ie)',
            ])->timeout(5)->get('https://nominatim.openstreetmap.org/search', [
                'q'            => $clean . ', Ireland',
                'format'       => 'json',
                'limit'        => 1,
                'countrycodes' => 'ie',
            ]);

            $results = $response->json();

            if (!empty($results[0])) {
                return [
                    'latitude'  => (float) $results[0]['lat'],
                    'longitude' => (float) $results[0]['lon'],
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Geocoding failed for eircode: ' . $eircode, ['error' => $e->getMessage()]);
        }

        return null;
    }
}
