<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number',
        'field_job_id',
        'customer_id',
        'issued_date',
        'due_date',
        'status',
        'subtotal',
        'discount_pct',
        'discount_amount',
        'vat_rate',
        'vat_amount',
        'total_due',
        'amount_paid',
        'payment_method',
        'paid_at',
        'payment_notes',
        'notes',
        'gnucash_exported_at',
        'loyalty_hours_earned',
        'loyalty_balance_after',
        'loyalty_credit_applied',
        'loyalty_credit_amount',
    ];

    protected function casts(): array
    {
        return [
            'issued_date'          => 'date',
            'due_date'             => 'date',
            'paid_at'              => 'date',
            'gnucash_exported_at'  => 'datetime',
            'subtotal'             => 'float',
            'discount_pct'         => 'float',
            'discount_amount'      => 'float',
            'vat_rate'             => 'float',
            'vat_amount'           => 'float',
            'total_due'            => 'float',
            'amount_paid'          => 'float',
            'loyalty_hours_earned'   => 'float',
            'loyalty_balance_after'  => 'float',
            'loyalty_credit_applied' => 'boolean',
            'loyalty_credit_amount'  => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(FieldJob::class, 'field_job_id');
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(InvoiceLineItem::class);
    }
}
