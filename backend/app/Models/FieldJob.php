<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FieldJob extends Model
{
    protected $fillable = [
        'customer_id',
        'project_id',
        'assigned_to',
        'title',
        'description',
        'type',
        'status',
        'weather_req',
        'estimated_hours',
        'priority',
        'scheduled_date',
        'due_by',
        'notes',
        'callout_fee',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date' => 'date',
            'due_by'         => 'date',
            'callout_fee'     => 'float',
            'estimated_hours' => 'float',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function workLogs(): HasMany
    {
        return $this->hasMany(WorkLog::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }
}
