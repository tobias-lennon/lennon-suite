<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Contact extends Model
{
    protected $fillable = [
        'type',
        'name',
        'company_name',
        'specialty',
        'phone',
        'email',
        'day_rate',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'day_rate'  => 'decimal:2',
        ];
    }
}
