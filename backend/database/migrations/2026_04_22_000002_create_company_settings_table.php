<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name')->default('Lennon Landscaping');
            $table->string('company_email')->nullable();
            $table->string('company_phone')->nullable();
            $table->string('vat_number')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('county')->nullable();
            $table->string('eircode')->nullable();
            $table->decimal('vat_rate', 5, 2)->default(13.5);
            $table->unsignedInteger('invoice_due_days')->default(30);
            $table->string('invoice_prefix')->default('LL');
            $table->unsignedInteger('loyalty_threshold_hours')->default(60);
            $table->unsignedInteger('target_billable_days')->default(160);
            $table->timestamps();
        });

        // Single-row settings — insert defaults immediately
        DB::table('company_settings')->insert([
            'company_name'           => 'Lennon Landscaping',
            'vat_rate'               => 13.5,
            'invoice_due_days'       => 30,
            'invoice_prefix'         => 'LL',
            'loyalty_threshold_hours'=> 60,
            'target_billable_days'   => 160,
            'created_at'             => now(),
            'updated_at'             => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
