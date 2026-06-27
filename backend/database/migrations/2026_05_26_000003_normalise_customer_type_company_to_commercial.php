<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('customers')->where('type', 'company')->update(['type' => 'commercial']);
    }

    public function down(): void
    {
        // Intentionally irreversible — 'company' was a legacy value, not worth restoring
    }
};
