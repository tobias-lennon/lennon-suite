<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_tasks', function (Blueprint $table) {
            $table->date('due_by')->nullable()->after('scheduled_time');
        });
    }

    public function down(): void
    {
        Schema::table('job_tasks', function (Blueprint $table) {
            $table->dropColumn('due_by');
        });
    }
};
