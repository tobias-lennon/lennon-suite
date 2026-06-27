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
        'custom_rate',
        'skip_loyalty',
        'maintenance_hours_balance',
        'minutes_from_hq',
        'latitude',
        'longitude',
    ];

    protected function casts(): array
    {
        return [
            'is_active'                  => 'boolean',
            'rating'                     => 'integer',
            'discount_pct'               => 'float',
            'default_callout_fee'        => 'float',
            'custom_rate'                => 'float',
            'skip_loyalty'               => 'boolean',
            'maintenance_hours_balance'  => 'float',
            'minutes_from_hq'            => 'integer',
            'latitude'                   => 'float',
            'longitude'                  => 'float',
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

    public function followups(): HasMany
    {
        return $this->hasMany(CustomerFollowup::class);
    }
}
