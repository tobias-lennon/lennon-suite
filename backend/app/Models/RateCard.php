<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RateCard extends Model
{
    protected $fillable = [
        'name',
        'base_rate',
        'power_tool_uplift',
        'waste_uplift',
        'maintenance_rate',
        'callout_fee',
        'callout_threshold_hours',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_rate'                => 'float',
            'power_tool_uplift'        => 'float',
            'waste_uplift'             => 'float',
            'maintenance_rate'         => 'float',
            'callout_fee'              => 'float',
            'callout_threshold_hours'  => 'float',
            'is_active'                => 'boolean',
        ];
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }
}
