<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete()->after('customer_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_crew')->default(false)->after('remember_token');
        });
    }

    public function down(): void
    {
        Schema::table('field_jobs', function (Blueprint $table) {
            $table->dropForeign(['assigned_to']);
            $table->dropColumn('assigned_to');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_crew');
        });
    }
};
