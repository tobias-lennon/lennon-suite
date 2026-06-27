<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->date('employment_start_date')->nullable()->after('is_active');
            $table->decimal('weekly_tax_credits', 8, 2)->nullable()->after('employment_start_date');
            $table->decimal('std_rate_cutoff_weekly', 8, 2)->nullable()->after('weekly_tax_credits');
            $table->enum('usc_status', ['standard', 'reduced', 'exempt'])->default('standard')->after('std_rate_cutoff_weekly');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['employment_start_date', 'weekly_tax_credits', 'std_rate_cutoff_weekly', 'usc_status']);
        });
    }
};
