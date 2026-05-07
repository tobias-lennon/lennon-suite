<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->index('is_active');
            $table->index('name');
            $table->index('type');
        });

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->index('status');
            $table->index('scheduled_date');
            $table->index('updated_at');
            $table->index('priority');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index('status');
            $table->index('issued_date');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex(['is_active']);
            $table->dropIndex(['name']);
            $table->dropIndex(['type']);
        });

        Schema::table('field_jobs', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['scheduled_date']);
            $table->dropIndex(['updated_at']);
            $table->dropIndex(['priority']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['issued_date']);
        });
    }
};
