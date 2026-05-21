<?php

namespace App\Http\Controllers;

use App\Models\FieldJob;
use App\Models\JobTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobTaskController extends Controller
{
    public function store(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'title'           => 'required|string|max:255',
            'estimated_hours' => 'nullable|numeric|min:0|max:999',
            'weather_req'     => 'in:any,light_rain_ok,dry_preferred,dry_only,frost_free',
            'scheduled_date'  => 'nullable|date',
            'scheduled_time'  => 'nullable|date_format:H:i',
            'due_by'          => 'nullable|date',
            'status'          => 'in:pending,in_progress,complete',
            'notes'           => 'nullable|string|max:2000',
        ]);

        $data['field_job_id'] = $job->id;
        $data['sort_order']   = (int) $job->tasks()->max('sort_order') + 1;

        $task = JobTask::create($data);

        return response()->json($this->format($task), 201);
    }

    public function update(Request $request, FieldJob $job, JobTask $task): JsonResponse
    {
        abort_if($task->field_job_id !== $job->id, 404);

        $data = $request->validate([
            'title'           => 'sometimes|string|max:255',
            'estimated_hours' => 'nullable|numeric|min:0|max:999',
            'weather_req'     => 'sometimes|in:any,light_rain_ok,dry_preferred,dry_only,frost_free',
            'scheduled_date'  => 'nullable|date',
            'scheduled_time'  => 'nullable|date_format:H:i',
            'due_by'          => 'nullable|date',
            'status'          => 'sometimes|in:pending,in_progress,complete',
            'sort_order'      => 'sometimes|integer|min:0',
            'notes'           => 'nullable|string|max:2000',
        ]);

        $task->update($data);

        return response()->json($this->format($task->fresh()));
    }

    public function destroy(FieldJob $job, JobTask $task): JsonResponse
    {
        abort_if($task->field_job_id !== $job->id, 404);

        $task->delete();

        return response()->json(null, 204);
    }

    private function format(JobTask $task): array
    {
        return [
            'id'              => $task->id,
            'title'           => $task->title,
            'estimated_hours' => $task->estimated_hours,
            'weather_req'     => $task->weather_req,
            'scheduled_date'  => $task->scheduled_date?->toDateString(),
            'scheduled_time'  => $task->scheduled_time ? substr($task->scheduled_time, 0, 5) : null,
            'due_by'          => $task->due_by?->toDateString(),
            'status'          => $task->status,
            'invoice_id'      => $task->invoice_id,
            'sort_order'      => $task->sort_order,
            'notes'           => $task->notes,
        ];
    }
}
