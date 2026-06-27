<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CompanySetting extends Model
{
    protected $fillable = [
        'company_name',
        'company_email',
        'company_phone',
        'vat_number',
        'address_line_1',
        'address_line_2',
        'city',
        'county',
        'eircode',
        'hq_latitude',
        'hq_longitude',
        'vat_rate',
        'invoice_due_days',
        'invoice_prefix',
        'loyalty_threshold_hours',
        'loyalty_credit_ex_vat',
        'target_billable_days',
    ];

    protected $casts = [
        'vat_rate'                => 'float',
        'invoice_due_days'        => 'integer',
        'loyalty_threshold_hours' => 'integer',
        'loyalty_credit_ex_vat'   => 'float',
        'target_billable_days'    => 'integer',
        'hq_latitude'             => 'float',
        'hq_longitude'            => 'float',
    ];

    // Always returns the single settings row
    public static function instance(): self
    {
        return static::firstOrCreate([], [
            'company_name'            => 'Lennon Landscaping',
            'vat_rate'                => 13.5,
            'invoice_due_days'        => 30,
            'invoice_prefix'          => 'LL',
            'loyalty_threshold_hours' => 60,
            'loyalty_credit_ex_vat'   => 251.10,
            'target_billable_days'    => 160,
        ]);
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return static::instance()->{$key} ?? $default;
    }
}
