<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_logs', function (Blueprint $table) {
            $table->foreignId('job_task_id')->nullable()->constrained('job_tasks')->nullOnDelete()->after('field_job_id');
        });
    }

    public function down(): void
    {
        Schema::table('work_logs', function (Blueprint $table) {
            $table->dropForeign(['job_task_id']);
            $table->dropColumn('job_task_id');
        });
    }
};
