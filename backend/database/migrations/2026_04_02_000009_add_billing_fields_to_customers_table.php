<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->foreignId('rate_card_id')->nullable()->constrained('rate_cards')->nullOnDelete();
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->decimal('maintenance_hours_balance', 6, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropForeign(['rate_card_id']);
            $table->dropColumn(['rate_card_id', 'discount_pct', 'maintenance_hours_balance']);
        });
    }
};
