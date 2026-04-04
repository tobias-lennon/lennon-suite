<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = ['name', 'pay_rate', 'is_active'];

    protected function casts(): array
    {
        return [
            'pay_rate'  => 'float',
            'is_active' => 'boolean',
        ];
    }

    public function workLogEntries(): HasMany
    {
        return $this->hasMany(WorkLogEntry::class);
    }
}
