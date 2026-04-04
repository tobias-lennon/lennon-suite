<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FieldJob extends Model
{
    protected $fillable = [
        'customer_id',
        'project_id',
        'title',
        'description',
        'type',
        'has_power_tools',
        'has_waste_disposal',
        'status',
        'weather_req',
        'est_duration',
        'priority',
        'scheduled_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'has_power_tools'   => 'boolean',
            'has_waste_disposal' => 'boolean',
            'scheduled_date'    => 'date',
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
}
