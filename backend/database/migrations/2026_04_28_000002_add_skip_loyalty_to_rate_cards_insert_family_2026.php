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
            $table->boolean('skip_loyalty')->default(false)->after('is_active');
        });

        DB::table('rate_cards')->insert([
            'name'                    => 'Family 2026',
            'base_rate'               => 26.43,
            'power_tool_uplift'       => 8.81,
            'waste_uplift'            => 13.22,
            'maintenance_rate'        => 38.04,
            'callout_fee'             => 0.00,
            'callout_threshold_hours' => 4.00,
            'is_active'               => true,
            'skip_loyalty'            => true,
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('rate_cards')->where('name', 'Family 2026')->delete();

        Schema::table('rate_cards', function (Blueprint $table) {
            $table->dropColumn('skip_loyalty');
        });
    }
};
