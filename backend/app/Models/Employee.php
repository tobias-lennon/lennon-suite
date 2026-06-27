<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'name', 'user_id', 'ppsn', 'pay_rate', 'is_active',
        'employment_start_date', 'weekly_tax_credits', 'std_rate_cutoff_weekly', 'usc_status',
    ];

    protected function casts(): array
    {
        return [
            'pay_rate'               => 'float',
            'is_active'              => 'boolean',
            'employment_start_date'  => 'date',
            'weekly_tax_credits'     => 'float',
            'std_rate_cutoff_weekly' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workLogEntries(): HasMany
    {
        return $this->hasMany(WorkLogEntry::class);
    }
}
