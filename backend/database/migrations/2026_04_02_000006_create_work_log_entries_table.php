<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_log_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->unsignedSmallInteger('break_minutes')->default(0);
            $table->decimal('billable_hours', 5, 2);
            $table->decimal('rate_per_hour', 8, 2);
            $table->decimal('pay_rate', 8, 2);
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->decimal('amount_charged', 10, 2);
            $table->decimal('amount_paid', 10, 2);
            $table->decimal('margin', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_log_entries');
    }
};
