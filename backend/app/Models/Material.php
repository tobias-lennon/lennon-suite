<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Material extends Model
{
    protected $fillable = [
        'work_log_id',
        'description',
        'qty',
        'unit',
        'cost_paid',
        'amount_charged',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'qty'            => 'float',
            'cost_paid'      => 'float',
            'amount_charged' => 'float',
        ];
    }

    public function workLog(): BelongsTo
    {
        return $this->belongsTo(WorkLog::class);
    }
}
