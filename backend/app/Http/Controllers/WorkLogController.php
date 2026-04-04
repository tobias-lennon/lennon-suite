<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\FieldJob;
use App\Models\Material;
use App\Models\WorkLog;
use App\Models\WorkLogEntry;
use App\Services\RateCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkLogController extends Controller
{
    public function __construct(private RateCalculationService $rateService) {}

    public function index(FieldJob $job): JsonResponse
    {
        $logs = $job->workLogs()
            ->with(['entries.employee:id,name', 'materials'])
            ->orderBy('date', 'desc')
            ->get();

        return response()->json($logs);
    }

    public function store(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'date'                      => 'required|date',
            'notes'                     => 'nullable|string',
            'entries'                   => 'array',
            'entries.*.employee_id'     => 'required|exists:employees,id',
            'entries.*.start_time'      => 'nullable|date_format:H:i',
            'entries.*.end_time'        => 'nullable|date_format:H:i',
            'entries.*.break_minutes'   => 'integer|min:0',
            'entries.*.billable_hours'  => 'required|numeric|min:0',
            'materials'                 => 'array',
            'materials.*.description'   => 'required|string|max:255',
            'materials.*.qty'           => 'nullable|numeric|min:0',
            'materials.*.unit'          => 'nullable|string|max:50',
            'materials.*.cost_paid'     => 'required|numeric|min:0',
            'materials.*.amount_charged' => 'required|numeric|min:0',
            'materials.*.notes'         => 'nullable|string',
        ]);

        $log = $job->workLogs()->create([
            'date'  => $data['date'],
            'notes' => $data['notes'] ?? null,
        ]);

        $isInternal = $job->type === 'internal';
        $customer   = $isInternal ? null : $job->customer()->with('rateCard')->first();
        $rate       = $isInternal ? 0 : $this->rateService->calculateRate($job, $customer);

        $totalMaintenanceHours = 0;

        foreach ($data['entries'] ?? [] as $entryData) {
            $employee      = Employee::find($entryData['employee_id']);
            $hours         = (float) $entryData['billable_hours'];
            $amountCharged = $isInternal ? 0 : round($hours * $rate, 2);
            $amountPaid    = round($hours * $employee->pay_rate, 2);

            WorkLogEntry::create([
                'work_log_id'    => $log->id,
                'employee_id'    => $entryData['employee_id'],
                'start_time'     => $entryData['start_time'] ?? null,
                'end_time'       => $entryData['end_time'] ?? null,
                'break_minutes'  => $entryData['break_minutes'] ?? 0,
                'billable_hours' => $hours,
                'rate_per_hour'  => $rate,
                'pay_rate'       => $employee->pay_rate,
                'discount_pct'   => $customer?->discount_pct ?? 0,
                'amount_charged' => $amountCharged,
                'amount_paid'    => $amountPaid,
                'margin'         => round($amountCharged - $amountPaid, 2),
            ]);

            if ($job->type === 'maintenance') {
                $totalMaintenanceHours += $hours;
            }
        }

        foreach ($data['materials'] ?? [] as $matData) {
            Material::create([
                'work_log_id'    => $log->id,
                'description'    => $matData['description'],
                'qty'            => $matData['qty'] ?? null,
                'unit'           => $matData['unit'] ?? null,
                'cost_paid'      => $matData['cost_paid'],
                'amount_charged' => $matData['amount_charged'],
                'notes'          => $matData['notes'] ?? null,
            ]);
        }

        if ($job->type === 'maintenance' && $totalMaintenanceHours > 0 && $customer) {
            $this->rateService->checkMaintenanceLoyalty($customer, $totalMaintenanceHours);
        }

        $log->load(['entries.employee:id,name', 'materials']);

        return response()->json($log, 201);
    }

    public function show(FieldJob $job, WorkLog $log): JsonResponse
    {
        abort_if($log->field_job_id !== $job->id, 404);

        $log->load(['entries.employee:id,name', 'materials']);

        return response()->json($log);
    }

    public function update(Request $request, FieldJob $job, WorkLog $log): JsonResponse
    {
        abort_if($log->field_job_id !== $job->id, 404);

        $data = $request->validate([
            'date'  => 'sometimes|date',
            'notes' => 'nullable|string',
        ]);

        $log->update($data);

        return response()->json($log->load(['entries.employee:id,name', 'materials']));
    }

    public function destroy(FieldJob $job, WorkLog $log): JsonResponse
    {
        abort_if($log->field_job_id !== $job->id, 404);

        $log->delete();

        return response()->json(null, 204);
    }
}
