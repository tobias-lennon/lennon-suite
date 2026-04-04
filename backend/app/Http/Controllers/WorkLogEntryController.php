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
            'employee_id'    => 'required|exists:employees,id',
            'start_time'     => 'nullable|date_format:H:i',
            'end_time'       => 'nullable|date_format:H:i',
            'break_minutes'  => 'integer|min:0',
            'billable_hours' => 'required|numeric|min:0',
        ]);

        $job      = $log->fieldJob()->with('customer.rateCard')->first();
        $customer = $job->customer;
        $employee = Employee::find($data['employee_id']);
        $rate     = $this->rateService->calculateRate($job, $customer);
        $hours    = (float) $data['billable_hours'];

        $amountCharged = round($hours * $rate, 2);
        $amountPaid    = round($hours * $employee->pay_rate, 2);

        $entry = WorkLogEntry::create([
            'work_log_id'    => $log->id,
            'employee_id'    => $data['employee_id'],
            'start_time'     => $data['start_time'] ?? null,
            'end_time'       => $data['end_time'] ?? null,
            'break_minutes'  => $data['break_minutes'] ?? 0,
            'billable_hours' => $hours,
            'rate_per_hour'  => $rate,
            'pay_rate'       => $employee->pay_rate,
            'discount_pct'   => $customer->discount_pct ?? 0,
            'amount_charged' => $amountCharged,
            'amount_paid'    => $amountPaid,
            'margin'         => round($amountCharged - $amountPaid, 2),
        ]);

        if ($job->type === 'maintenance') {
            $this->rateService->checkMaintenanceLoyalty($customer, $hours);
        }

        return response()->json($entry->load('employee:id,name'), 201);
    }

    public function update(Request $request, WorkLog $log, WorkLogEntry $entry): JsonResponse
    {
        abort_if($entry->work_log_id !== $log->id, 404);

        $data = $request->validate([
            'start_time'     => 'nullable|date_format:H:i',
            'end_time'       => 'nullable|date_format:H:i',
            'break_minutes'  => 'integer|min:0',
            'billable_hours' => 'required|numeric|min:0',
        ]);

        $hours         = (float) $data['billable_hours'];
        $amountCharged = round($hours * $entry->rate_per_hour, 2);
        $amountPaid    = round($hours * $entry->pay_rate, 2);

        $entry->update(array_merge($data, [
            'billable_hours' => $hours,
            'amount_charged' => $amountCharged,
            'amount_paid'    => $amountPaid,
            'margin'         => round($amountCharged - $amountPaid, 2),
        ]));

        return response()->json($entry->load('employee:id,name'));
    }

    public function destroy(WorkLog $log, WorkLogEntry $entry): JsonResponse
    {
        abort_if($entry->work_log_id !== $log->id, 404);

        $entry->delete();

        return response()->json(null, 204);
    }
}
