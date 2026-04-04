<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rate_cards', function (Blueprint $table) {
            // Callout fee applied to non-maintenance jobs <= 4 billable hours
            $table->decimal('callout_fee', 8, 2)->default(0)->after('maintenance_rate');
            // Threshold in hours below which callout applies
            $table->decimal('callout_threshold_hours', 4, 2)->default(4.00)->after('callout_fee');
        });

        // Update "Standard 2026" with correct ex-VAT rates (all figures provided inc. 13.5% VAT)
        // Formula: inc_vat / 1.135
        DB::table('rate_cards')->where('name', 'Standard 2026')->update([
            'base_rate'              => 26.43,  // €30.00 inc VAT
            'power_tool_uplift'      => 8.81,   // €10.00 inc VAT
            'waste_uplift'           => 13.22,  // €15.00 inc VAT
            'maintenance_rate'       => 41.85,  // €47.50 inc VAT
            'callout_fee'            => 70.48,  // €80.00 inc VAT
            'callout_threshold_hours'=> 4.00,
        ]);
    }

    public function down(): void
    {
        Schema::table('rate_cards', function (Blueprint $table) {
            $table->dropColumn(['callout_fee', 'callout_threshold_hours']);
        });

        DB::table('rate_cards')->where('name', 'Standard 2026')->update([
            'base_rate'        => 35.00,
            'power_tool_uplift'=> 10.00,
            'waste_uplift'     => 10.00,
            'maintenance_rate' => 30.00,
        ]);
    }
};
