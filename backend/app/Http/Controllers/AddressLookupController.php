<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AddressLookupController extends Controller
{
    public function autocomplete(Request $request): JsonResponse
    {
        $request->validate(['query' => 'required|string|min:1|max:100']);

        $apiKey = config('services.autoaddress.key');

        if (!$apiKey) {
            return response()->json(['error' => 'Address lookup not configured'], 503);
        }

        $response = Http::timeout(5)->get('https://api.autoaddress.com/3.0/autocomplete', [
            'key'     => $apiKey,
            'address' => $request->query('query'),
            'country' => 'IE',
            'limit'   => 8,
        ]);

        if (!$response->successful()) {
            return response()->json(['suggestions' => []]);
        }

        $data    = $response->json();
        $options = $data['options'] ?? [];

        $suggestions = array_map(fn($opt) => [
            'display_name' => $opt['value'] ?? '',
            'ecad_id'      => $opt['link']['href'] ?? '',
        ], $options);

        return response()->json(['suggestions' => $suggestions]);
    }

    public function resolve(Request $request): JsonResponse
    {
        $request->validate(['ecad_id' => 'required|string']);

        $apiKey = config('services.autoaddress.key');

        if (!$apiKey) {
            return response()->json(['error' => 'Address lookup not configured'], 503);
        }

        $lookupUrl = $request->query('ecad_id');

        // Only allow URLs that came from autoaddress
        if (!str_starts_with($lookupUrl, 'https://api.autoaddress.com/')) {
            return response()->json(['address' => null], 400);
        }

        $response = Http::timeout(5)->get($lookupUrl);

        if (!$response->successful()) {
            return response()->json(['address' => null]);
        }

        $data = $response->json();
        $addr = $data['address'] ?? null;

        if (!$addr) {
            return response()->json(['address' => null]);
        }

        // Map lines array: key can be "AddressLine1", "AddressLine2", etc.
        $lineMap = [];
        foreach ($addr['lines'] ?? [] as $line) {
            $lineMap[$line['key']] = $line['value'];
        }

        return response()->json([
            'address' => [
                'address_line_1' => $lineMap['AddressLine1'] ?? null,
                'address_line_2' => $lineMap['AddressLine2'] ?? null,
                'city'           => $addr['city']['value'] ?? null,
                'county'         => $addr['region']['value'] ?? null,
                'eircode'        => $addr['postcode']['value'] ?? null,
            ],
        ]);
    }
}
