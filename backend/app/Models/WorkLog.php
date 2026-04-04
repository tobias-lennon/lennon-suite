<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkLog extends Model
{
    protected $fillable = ['field_job_id', 'date', 'notes'];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function fieldJob(): BelongsTo
    {
        return $this->belongsTo(FieldJob::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(WorkLogEntry::class);
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class);
    }
}
