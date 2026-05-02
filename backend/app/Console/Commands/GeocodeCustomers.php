<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Services\GeocodingService;
use Illuminate\Console\Command;

class GeocodeCustomers extends Command
{
    protected $signature   = 'customers:geocode {--dry-run : Show what would be updated without saving}';
    protected $description = 'Geocode customers who have an eircode but no lat/lng coordinates';

    public function handle(GeocodingService $geocoding): int
    {
        $customers = Customer::whereHas('address', fn($q) => $q->whereNotNull('postcode'))
            ->whereNull('latitude')
            ->get();

        if ($customers->isEmpty()) {
            $this->info('All customers with eircodes already have coordinates.');
            return 0;
        }

        $this->info("Found {$customers->count()} customer(s) to geocode.");
        $done = 0; $failed = 0;

        foreach ($customers as $customer) {
            $postcode = $customer->address->postcode;
            $coords   = $geocoding->geocodeEircode($postcode);

            if ($coords) {
                if (!$this->option('dry-run')) {
                    $customer->update(['latitude' => $coords['latitude'], 'longitude' => $coords['longitude']]);
                }
                $this->line("  OK  {$customer->name} ({$postcode}) → {$coords['latitude']}, {$coords['longitude']}");
                $done++;
            } else {
                $this->warn("  --  {$customer->name} ({$postcode}) → no result");
                $failed++;
            }

            // Nominatim rate limit: 1 request per second
            usleep(1100000);
        }

        $this->info("Done. {$done} geocoded, {$failed} failed.");
        return 0;
    }
}
