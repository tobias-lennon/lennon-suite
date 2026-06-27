<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\WorkLog;
use App\Models\WorkLogEntry;
use App\Services\RateCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkLogEntryController extends Controller
{
    public function __construct(private RateCalculationService $rateService) {}

    public function store(Request $request, WorkLog $log): JsonResponse
    {
        $data = $request->validate([
            'employee_id'     => 'required|exists:employees,id',
            'start_time'      => 'nullable|date_format:H:i',
            'end_time'        => 'nullable|date_format:H:i',
            'break_minutes'   => 'integer|min:0',
            'billable_hours'  => 'required|numeric|min:0',
            'has_power_tools' => 'boolean',
        ]);

        $job           = $log->fieldJob()->with('customer.rateCard')->first();
        $isInternal    = $job->type === 'internal';
        $customer      = $isInternal ? null : $job->customer;
        $employee      = Employee::find($data['employee_id']);
        $hasPowerTools = (bool) ($data['has_power_tools'] ?? false);
        $rate          = $isInternal ? 0 : $this->rateService->calculateRate($job, $customer, $hasPowerTools, (bool) $log->has_waste_disposal);
        $hours         = (float) $data['billable_hours'];

        $amountCharged = $isInternal ? 0 : round($hours * $rate, 2);
        $amountPaid    = round($hours * $employee->pay_rate, 2);

        $entry = WorkLogEntry::create([
            'work_log_id'     => $log->id,
            'employee_id'     => $data['employee_id'],
            'start_time'      => $data['start_time'] ?? null,
            'end_time'        => $data['end_time'] ?? null,
            'break_minutes'   => $data['break_minutes'] ?? 0,
            'has_power_tools' => $hasPowerTools,
            'billable_hours'  => $hours,
            'rate_per_hour'   => $rate,
            'pay_rate'        => $employee->pay_rate,
            'discount_pct'    => $customer?->discount_pct ?? 0,
            'amount_charged'  => $amountCharged,
            'amount_paid'     => $amountPaid,
            'margin'          => round($amountCharged - $amountPaid, 2),
        ]);

        if ($job->type === 'maintenance' && $customer) {
            $this->rateService->checkMaintenanceLoyalty($customer, $hours);
        }

        return response()->json($entry->load('employee:id,name'), 201);
    }

    public function update(Request $request, WorkLog $log, WorkLogEntry $entry): JsonResponse
    {
        abort_if($entry->work_log_id !== $log->id, 404);

        $data = $request->validate([
            'employee_id'     => 'sometimes|exists:employees,id',
            'start_time'      => 'nullable|date_format:H:i',
            'end_time'        => 'nullable|date_format:H:i',
            'break_minutes'   => 'integer|min:0',
            'billable_hours'  => 'required|numeric|min:0',
            'has_power_tools' => 'boolean',
        ]);

        $oldHours        = (float) $entry->billable_hours;
        $employeeChanged = isset($data['employee_id']) && (int) $data['employee_id'] !== $entry->employee_id;
        $employee        = $employeeChanged ? Employee::find($data['employee_id']) : null;
        $payRate         = $employee ? $employee->pay_rate : $entry->pay_rate;

        $ratePerHour = $entry->rate_per_hour;
        if ($employeeChanged || array_key_exists('has_power_tools', $data)) {
            $job      = $log->fieldJob()->with('customer.rateCard')->first();
            $customer = $job->customer;
            if ($customer) {
                $hasPowerTools = (bool) ($data['has_power_tools'] ?? $entry->has_power_tools);
                $ratePerHour   = $this->rateService->calculateRate(
                    $job, $customer,
                    $hasPowerTools,
                    (bool) $log->has_waste_disposal
                );
            }
        }

        $hours         = (float) $data['billable_hours'];
        $amountCharged = round($hours * $ratePerHour, 2);
        $amountPaid    = round($hours * $payRate, 2);

        $entry->update(array_merge($data, [
            'pay_rate'       => $payRate,
            'billable_hours' => $hours,
            'rate_per_hour'  => $ratePerHour,
            'amount_charged' => $amountCharged,
            'amount_paid'    => $amountPaid,
            'margin'         => round($amountCharged - $amountPaid, 2),
        ]));

        $hoursDiff = round($hours - $oldHours, 2);
        if ($hoursDiff != 0) {
            if (!isset($job)) {
                $job = $log->fieldJob()->with('customer.rateCard')->first();
            }
            if ($job->type === 'maintenance' && $job->customer) {
                if ($hoursDiff > 0) {
                    $this->rateService->checkMaintenanceLoyalty($job->customer, $hoursDiff);
                } else {
                    $this->rateService->reverseMaintenanceLoyalty($job->customer, abs($hoursDiff));
                }
            }
        }

        return response()->json($entry->load('employee:id,name'));
    }

    public function destroy(WorkLog $log, WorkLogEntry $entry): JsonResponse
    {
        abort_if($entry->work_log_id !== $log->id, 404);

        $job = $log->fieldJob()->with('customer.rateCard')->first();
        if ($job->type === 'maintenance' && $job->customer) {
            $this->rateService->reverseMaintenanceLoyalty($job->customer, (float) $entry->billable_hours);
        }

        $entry->delete();

        return response()->json(null, 204);
    }
}
