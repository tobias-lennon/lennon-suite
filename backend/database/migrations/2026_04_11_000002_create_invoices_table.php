<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number', 20)->unique();
            $table->foreignId('field_job_id')->unique()->constrained('field_jobs')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers');
            $table->date('issued_date');
            $table->date('due_date');
            $table->enum('status', ['draft', 'sent', 'paid'])->default('draft');

            // Financials
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('vat_rate', 5, 2)->default(13.5);
            $table->decimal('vat_amount', 10, 2);
            $table->decimal('total_due', 10, 2);

            // Payment
            $table->decimal('amount_paid', 10, 2)->nullable();
            $table->enum('payment_method', ['cash', 'bank_transfer'])->nullable();
            $table->date('paid_at')->nullable();
            $table->text('payment_notes')->nullable();

            $table->text('notes')->nullable();
            $table->timestamp('gnucash_exported_at')->nullable();
            $table->timestamps();
        });

        Schema::create('invoice_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['labour', 'material']);
            $table->string('description', 500);
            $table->decimal('quantity', 8, 2);
            $table->decimal('unit_price', 10, 2);
            $table->decimal('amount', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_line_items');
        Schema::dropIfExists('invoices');
    }
};
