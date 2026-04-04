<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Make customer_id nullable
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->change();
        });

        // Extend the type enum to include 'internal'
        DB::statement("ALTER TABLE field_jobs MODIFY COLUMN type ENUM('standard','maintenance','site_visit','internal') NOT NULL DEFAULT 'standard'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE field_jobs MODIFY COLUMN type ENUM('standard','maintenance','site_visit') NOT NULL DEFAULT 'standard'");

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable(false)->change();
        });
    }
};
