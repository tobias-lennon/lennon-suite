<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rate_cards', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->decimal('base_rate', 8, 2);
            $table->decimal('power_tool_uplift', 8, 2)->default(0);
            $table->decimal('waste_uplift', 8, 2)->default(0);
            $table->decimal('maintenance_rate', 8, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_cards');
    }
};
