<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->decimal('hq_latitude',  10, 7)->nullable()->after('eircode');
            $table->decimal('hq_longitude', 10, 7)->nullable()->after('hq_latitude');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['hq_latitude', 'hq_longitude']);
        });
    }
};
