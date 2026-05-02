<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    protected $fillable = [
        'name',
        'phone',
        'email',
        'eircode',
        'source',
        'status',
        'requires_site_visit',
        'notes',
        'converted_customer_id',
    ];

    protected function casts(): array
    {
        return [
            'requires_site_visit' => 'boolean',
        ];
    }

    public function convertedCustomer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'converted_customer_id');
    }
}
