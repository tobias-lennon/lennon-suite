<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->decimal('estimated_hours', 5, 2)->nullable()->after('est_duration');
        });

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->dropColumn('est_duration');
        });
    }

    public function down(): void
    {
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->enum('est_duration', ['quick', 'half_day', 'full_day', 'multi_day'])->nullable()->after('estimated_hours');
        });

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->dropColumn('estimated_hours');
        });
    }
};
