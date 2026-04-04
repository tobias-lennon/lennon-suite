<?php

namespace Database\Seeders;

use App\Models\Address;
use App\Models\Customer;
use Illuminate\Database\Seeder;
use PhpOffice\PhpSpreadsheet\IOFactory;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $dir = __DIR__;

        // --- Customers ---
        $customerFile = "{$dir}/customer.csv";
        if (! file_exists($customerFile)) {
            $this->command->warn("customer.csv not found in seeders directory.");
            return;
        }

        $customers = [];
        $fh = fopen($customerFile, 'r');
        fgetcsv($fh); // skip header

        while (($row = fgetcsv($fh)) !== false) {
            [$legacyId, , $name, $type, $phone, $email, $notes, $rating] = array_pad($row, 8, '');
            if (empty(trim($name))) continue;

            $customers[trim($legacyId)] = [
                'legacy_id' => trim($legacyId),
                'name'      => trim($name),
                'type'      => trim($type) ?: 'residential',
                'phone'     => trim($phone) ?: null,
                'email'     => trim($email) ?: null,
                'notes'     => trim($notes) ?: null,
                'rating'    => is_numeric(trim($rating)) ? (int) trim($rating) : null,
            ];
        }
        fclose($fh);

        $this->command->info('Importing ' . count($customers) . ' customers...');
        $customerModels = [];

        foreach ($customers as $legacyId => $data) {
            $customer = Customer::create($data);
            $customerModels[$legacyId] = $customer->id;
        }

        // --- Addresses ---
        $addressFile = "{$dir}/address.csv";
        $addrCount   = 0;
        $fh = fopen($addressFile, 'r');
        fgetcsv($fh); // skip header

        while (($row = fgetcsv($fh)) !== false) {
            [$addrLegacyId, $custLegacyId, $line1, $line2, $city, $county, $postcode] = array_pad($row, 7, '');
            $custLegacyId = trim($custLegacyId);
            if (empty($custLegacyId) || ! isset($customerModels[$custLegacyId])) continue;

            Address::create([
                'legacy_id'      => trim($addrLegacyId),
                'customer_id'    => $customerModels[$custLegacyId],
                'address_line_1' => trim($line1) ?: null,
                'address_line_2' => trim($line2) ?: null,
                'city'           => trim($city) ?: null,
                'county'         => trim($county) ?: null,
                'postcode'       => trim($postcode) ?: null,
            ]);
            $addrCount++;
        }
        fclose($fh);

        $this->command->info("Done. {$addrCount} addresses imported.");
    }
}
