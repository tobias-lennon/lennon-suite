<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('rate_cards')->where('name', 'Family 2026')->update(['is_active' => false]);
    }

    public function down(): void
    {
        DB::table('rate_cards')->where('name', 'Family 2026')->update(['is_active' => true]);
    }
};
