<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('field_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('type', ['standard', 'maintenance', 'site_visit'])->default('standard');
            $table->boolean('has_power_tools')->default(false);
            $table->boolean('has_waste_disposal')->default(false);
            $table->enum('status', ['backlog', 'scheduled', 'in_progress', 'complete'])->default('backlog');
            $table->enum('weather_req', ['any', 'dry_preferred', 'dry_only'])->default('any');
            $table->enum('est_duration', ['quick', 'half_day', 'full_day', 'multi_day'])->nullable();
            $table->enum('priority', ['normal', 'high', 'urgent'])->default('normal');
            $table->date('scheduled_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('field_jobs');
    }
};
