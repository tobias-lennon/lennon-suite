<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payslips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->restrictOnDelete();
            $table->decimal('hours_logged', 8, 2)->default(0);
            $table->decimal('hours_extra', 8, 2)->default(0);
            $table->string('extra_description')->nullable();
            $table->decimal('gross_pay', 10, 2)->default(0);
            $table->decimal('paye', 10, 2)->default(0);
            $table->decimal('prsi_employee', 10, 2)->default(0);
            $table->decimal('prsi_employer', 10, 2)->default(0);
            $table->decimal('usc', 10, 2)->default(0);
            $table->decimal('net_pay', 10, 2)->default(0);
            $table->timestamp('emailed_at')->nullable();
            $table->timestamps();
            $table->unique(['payroll_run_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payslips');
    }
};
