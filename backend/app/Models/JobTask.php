<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobTask extends Model
{
    protected $table = 'job_tasks';

    protected $fillable = [
        'field_job_id',
        'title',
        'estimated_hours',
        'weather_req',
        'scheduled_date',
        'scheduled_time',
        'status',
        'invoice_id',
        'sort_order',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_date'  => 'date',
            'estimated_hours' => 'float',
            'sort_order'      => 'integer',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(FieldJob::class, 'field_job_id');
    }

    public function workLogs(): HasMany
    {
        return $this->hasMany(WorkLog::class, 'job_task_id');
    }
}
