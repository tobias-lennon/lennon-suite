<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_logs', function (Blueprint $table) {
            $table->boolean('has_waste_disposal')->default(false)->after('notes');
        });

        Schema::table('work_log_entries', function (Blueprint $table) {
            $table->boolean('has_power_tools')->default(false)->after('break_minutes');
        });

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->dropColumn(['has_power_tools', 'has_waste_disposal']);
        });
    }

    public function down(): void
    {
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->boolean('has_power_tools')->default(false);
            $table->boolean('has_waste_disposal')->default(false);
        });

        Schema::table('work_log_entries', function (Blueprint $table) {
            $table->dropColumn('has_power_tools');
        });

        Schema::table('work_logs', function (Blueprint $table) {
            $table->dropColumn('has_waste_disposal');
        });
    }
};
