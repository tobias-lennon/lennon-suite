<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkLogEntry extends Model
{
    protected $fillable = [
        'work_log_id',
        'employee_id',
        'start_time',
        'end_time',
        'break_minutes',
        'billable_hours',
        'rate_per_hour',
        'pay_rate',
        'discount_pct',
        'amount_charged',
        'amount_paid',
        'margin',
    ];

    protected function casts(): array
    {
        return [
            'billable_hours'  => 'float',
            'rate_per_hour'   => 'float',
            'pay_rate'        => 'float',
            'discount_pct'    => 'float',
            'amount_charged'  => 'float',
            'amount_paid'     => 'float',
            'margin'          => 'float',
            'break_minutes'   => 'integer',
        ];
    }

    public function workLog(): BelongsTo
    {
        return $this->belongsTo(WorkLog::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
