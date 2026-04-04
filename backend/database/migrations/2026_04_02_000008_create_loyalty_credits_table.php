<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->decimal('hours_at_trigger', 5, 2);
            $table->timestamp('earned_at');
            $table->enum('type', ['invoice_discount', 'nursery_credit'])->default('invoice_discount');
            $table->enum('status', ['pending', 'applied'])->default('pending');
            $table->unsignedBigInteger('applied_to_invoice_id')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_credits');
    }
};
