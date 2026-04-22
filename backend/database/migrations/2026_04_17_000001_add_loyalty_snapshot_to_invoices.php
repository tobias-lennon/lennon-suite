<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->float('loyalty_hours_earned')->nullable()->after('notes');
            $table->float('loyalty_balance_after')->nullable()->after('loyalty_hours_earned');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['loyalty_hours_earned', 'loyalty_balance_after']);
        });
    }
};
