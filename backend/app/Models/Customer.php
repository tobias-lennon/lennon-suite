<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Customer extends Model
{
    protected $fillable = [
        'legacy_id',
        'name',
        'type',
        'phone',
        'email',
        'notes',
        'rating',
        'is_active',
        'rate_card_id',
        'discount_pct',
        'default_callout_fee',
        'maintenance_hours_balance',
    ];

    protected function casts(): array
    {
        return [
            'is_active'                  => 'boolean',
            'rating'                     => 'integer',
            'discount_pct'               => 'float',
            'default_callout_fee'        => 'float',
            'maintenance_hours_balance'  => 'float',
        ];
    }

    public function address(): HasOne
    {
        return $this->hasOne(Address::class);
    }

    public function rateCard(): BelongsTo
    {
        return $this->belongsTo(RateCard::class);
    }

    public function fieldJobs(): HasMany
    {
        return $this->hasMany(FieldJob::class);
    }

    public function loyaltyCredits(): HasMany
    {
        return $this->hasMany(LoyaltyCredit::class);
    }
}
