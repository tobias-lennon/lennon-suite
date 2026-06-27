<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class MyHoursController extends Controller
{
    public function index(): JsonResponse
    {
        $employee = Employee::where('user_id', Auth::id())->first();

        if (!$employee) {
            return response()->json(['entries' => [], 'employee' => null]);
        }

        $entries = $employee->workLogEntries()
            ->with([
                'workLog:id,field_job_id,date',
                'workLog.job:id,title,customer_id',
                'workLog.job.customer:id,name',
            ])
            ->orderByDesc(fn($q) => $q->select('date')
                ->from('work_logs')
                ->whereColumn('work_logs.id', 'work_log_entries.work_log_id')
                ->limit(1)
            )
            ->get()
            ->map(fn($entry) => [
                'id'             => $entry->id,
                'date'           => $entry->workLog?->date,
                'job_title'      => $entry->workLog?->job?->title,
                'customer_name'  => $entry->workLog?->job?->customer?->name,
                'billable_hours' => $entry->billable_hours,
            ]);

        return response()->json([
            'employee' => ['id' => $employee->id, 'name' => $employee->name],
            'entries'  => $entries,
        ]);
    }
}
