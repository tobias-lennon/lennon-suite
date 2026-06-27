<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payslip extends Model
{
    protected $fillable = [
        'payroll_run_id', 'employee_id',
        'hours_logged', 'hours_extra', 'extra_description',
        'gross_pay', 'paye', 'prsi_employee', 'prsi_employer', 'usc', 'net_pay',
        'emailed_at',
    ];

    protected function casts(): array
    {
        return [
            'hours_logged'   => 'float',
            'hours_extra'    => 'float',
            'gross_pay'      => 'float',
            'paye'           => 'float',
            'prsi_employee'  => 'float',
            'prsi_employer'  => 'float',
            'usc'            => 'float',
            'net_pay'        => 'float',
            'emailed_at'     => 'datetime',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
