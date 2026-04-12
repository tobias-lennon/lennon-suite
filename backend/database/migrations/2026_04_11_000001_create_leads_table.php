<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200);
            $table->string('phone', 30)->nullable();
            $table->string('email', 255)->nullable();
            $table->enum('source', ['word_of_mouth', 'google', 'instagram', 'referral', 'other'])->default('other');
            $table->enum('status', ['new', 'contacted', 'quoted', 'won', 'lost'])->default('new');
            $table->text('notes')->nullable();
            $table->foreignId('converted_customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
