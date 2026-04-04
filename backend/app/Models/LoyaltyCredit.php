<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoyaltyCredit extends Model
{
    protected $fillable = [
        'customer_id',
        'hours_at_trigger',
        'earned_at',
        'type',
        'status',
        'applied_to_invoice_id',
        'applied_at',
    ];

    protected function casts(): array
    {
        return [
            'hours_at_trigger'      => 'float',
            'earned_at'             => 'datetime',
            'applied_at'            => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
