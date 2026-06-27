<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('loyalty_credit_applied')->default(false)->after('loyalty_balance_after');
            $table->decimal('loyalty_credit_amount', 10, 2)->nullable()->after('loyalty_credit_applied');
        });

        Schema::table('company_settings', function (Blueprint $table) {
            $table->decimal('loyalty_credit_ex_vat', 8, 2)->default(251.10)->after('loyalty_threshold_hours');
        });

        DB::table('company_settings')->update(['loyalty_credit_ex_vat' => 251.10]);
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['loyalty_credit_applied', 'loyalty_credit_amount']);
        });
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('loyalty_credit_ex_vat');
        });
    }
};
