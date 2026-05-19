<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('field_job_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->decimal('estimated_hours', 5, 2)->nullable();
            $table->enum('weather_req', ['any', 'light_rain_ok', 'dry_preferred', 'dry_only', 'frost_free'])->default('any');
            $table->date('scheduled_date')->nullable();
            $table->time('scheduled_time')->nullable();
            $table->enum('status', ['pending', 'in_progress', 'complete'])->default('pending');
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_tasks');
    }
};
