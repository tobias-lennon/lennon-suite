<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RateCardSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('rate_cards')->insert([
            [
                'name'               => 'Standard 2026',
                'base_rate'          => 35.00,
                'power_tool_uplift'  => 10.00,
                'waste_uplift'       => 10.00,
                'maintenance_rate'   => 30.00,
                'is_active'          => true,
                'created_at'         => now(),
                'updated_at'         => now(),
            ],
        ]);
    }
}
