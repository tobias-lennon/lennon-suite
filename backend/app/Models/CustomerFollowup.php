<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerFollowup extends Model
{
    protected $fillable = ['customer_id', 'note', 'follow_up_date', 'resolved_at'];

    protected function casts(): array
    {
        return [
            'follow_up_date' => 'date',
            'resolved_at'    => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
