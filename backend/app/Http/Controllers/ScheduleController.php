<?php

namespace App\Http\Controllers;

use App\Models\FieldJob;
use App\Models\JobTask;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ScheduleController extends Controller
{
    public function __construct(private WeatherService $weather) {}

    public function week(Request $request): JsonResponse
    {
        $weekStart = $request->filled('week_start')
            ? Carbon::parse($request->week_start)->startOfDay()
            : Carbon::now()->startOfWeek(Carbon::MONDAY);

        $weekEnd = $weekStart->copy()->addDays(6)->endOfDay();

        $customerSelect = 'id,name,minutes_from_hq,latitude,longitude';

        $scheduled = FieldJob::with(["customer:{$customerSelect}"])
            ->whereNotNull('scheduled_date')
            ->whereBetween('scheduled_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->whereNotIn('status', ['complete'])
            ->orderBy('scheduled_date')
            ->get();

        $overdue = FieldJob::with(["customer:{$customerSelect}"])
            ->whereNotNull('scheduled_date')
            ->where('scheduled_date', '<', $weekStart->toDateString())
            ->whereNotIn('status', ['complete'])
            ->orderBy('scheduled_date')
            ->get();

        $unscheduled = FieldJob::with(["customer:{$customerSelect}"])
            ->whereNull('scheduled_date')
            ->whereNotIn('status', ['complete'])
            ->orderByRaw("FIELD(status, 'in_progress', 'backlog', 'scheduled')")
            ->orderBy('created_at')
            ->get();

        $scheduledTasks = JobTask::with(['job.customer:id,name,minutes_from_hq,latitude,longitude'])
            ->whereNotNull('scheduled_date')
            ->whereBetween('scheduled_date', [$weekStart->toDateString(), $weekEnd->toDateString()])
            ->whereNotIn('status', ['complete'])
            ->orderBy('scheduled_date')
            ->orderBy('scheduled_time')
            ->get();

        $overdueTasks = JobTask::with(['job.customer:id,name,minutes_from_hq,latitude,longitude'])
            ->whereNotNull('scheduled_date')
            ->where('scheduled_date', '<', $weekStart->toDateString())
            ->whereNotIn('status', ['complete'])
            ->orderBy('scheduled_date')
            ->get();

        $unscheduledTasks = JobTask::with(['job.customer:id,name,minutes_from_hq,latitude,longitude'])
            ->whereNull('scheduled_date')
            ->whereNotIn('status', ['complete'])
            ->orderBy('sort_order')
            ->get();

        $allJobs = $scheduled->merge($overdue)->merge($unscheduled)
            ->merge($scheduledTasks->map->job)
            ->merge($overdueTasks->map->job)
            ->merge($unscheduledTasks->map->job);

        $forecastsByCoords = $this->buildForecastsMap($allJobs->filter());

        return response()->json([
            'week_start'        => $weekStart->toDateString(),
            'week_end'          => $weekEnd->toDateString(),
            'scheduled'         => $scheduled->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
            'overdue'           => $overdue->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
            'unscheduled'       => $unscheduled->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
            'scheduled_tasks'   => $scheduledTasks->map(fn($t) => $this->taskSummary($t, $forecastsByCoords))->values(),
            'overdue_tasks'     => $overdueTasks->map(fn($t) => $this->taskSummary($t, $forecastsByCoords))->values(),
            'unscheduled_tasks' => $unscheduledTasks->map(fn($t) => $this->taskSummary($t, $forecastsByCoords))->values(),
        ]);
    }

    public function updateDate(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'scheduled_date' => 'nullable|date',
        ]);

        $updates = ['scheduled_date' => $data['scheduled_date']];
        if ($data['scheduled_date'] !== null && $job->status === 'backlog') {
            $updates['status'] = 'scheduled';
        } elseif ($data['scheduled_date'] === null && $job->status === 'scheduled') {
            $updates['status'] = 'backlog';
        }
        $job->update($updates);

        $fresh = $job->fresh()->load('customer:id,name,minutes_from_hq,latitude,longitude');
        $forecastsByCoords = $this->buildForecastsMap(collect([$fresh]));

        return response()->json($this->jobSummary($fresh, $forecastsByCoords));
    }

    public function updateTaskDate(Request $request, JobTask $task): JsonResponse
    {
        $data = $request->validate([
            'scheduled_date' => 'nullable|date',
        ]);

        $task->update(['scheduled_date' => $data['scheduled_date']]);

        $fresh = $task->fresh()->load('job.customer:id,name,minutes_from_hq,latitude,longitude');
        $forecastsByCoords = $this->buildForecastsMap(collect([$fresh->job])->filter());

        return response()->json($this->taskSummary($fresh, $forecastsByCoords));
    }

    private function buildForecastsMap($jobs): array
    {
        $map = [];
        foreach ($jobs as $job) {
            $c = $job->customer;
            if ($c && $c->latitude && $c->longitude) {
                $key = $this->coordKey($c->latitude, $c->longitude);
                if (!isset($map[$key])) {
                    $map[$key] = $this->weather->getForecast((float) $c->latitude, (float) $c->longitude);
                }
            }
        }
        return $map;
    }

    private function coordKey(float $lat, float $lng): string
    {
        return round($lat, 4) . '_' . round($lng, 4);
    }

    private function jobSummary(FieldJob $job, array $forecastsByCoords = []): array
    {
        $customerForecast = null;
        $c = $job->customer;
        if ($c && $c->latitude && $c->longitude) {
            $key      = $this->coordKey($c->latitude, $c->longitude);
            $forecasts = $forecastsByCoords[$key] ?? [];
            $customerForecast = array_values(array_map(
                fn($f) => ['date' => $f['date'], 'condition' => $f['condition']],
                $forecasts
            ));
        }

        return [
            'id'                => $job->id,
            'title'             => $job->title,
            'type'              => $job->type,
            'status'            => $job->status,
            'scheduled_date'    => $job->scheduled_date?->toDateString(),
            'due_by'            => $job->due_by?->toDateString(),
            'priority'          => $job->priority,
            'weather_req'       => $job->weather_req,
            'customer_forecast' => $customerForecast,
            'customer'          => $c ? [
                'id'              => $c->id,
                'name'            => $c->name,
                'minutes_from_hq' => $c->minutes_from_hq,
            ] : null,
        ];
    }

    private function taskSummary(JobTask $task, array $forecastsByCoords = []): array
    {
        $job = $task->job;
        $c   = $job?->customer;

        $customerForecast = null;
        if ($c && $c->latitude && $c->longitude) {
            $key      = $this->coordKey($c->latitude, $c->longitude);
            $forecasts = $forecastsByCoords[$key] ?? [];
            $customerForecast = array_values(array_map(
                fn($f) => ['date' => $f['date'], 'condition' => $f['condition']],
                $forecasts
            ));
        }

        return [
            'id'              => $task->id,
            'title'           => $task->title,
            'status'          => $task->status,
            'weather_req'     => $task->weather_req,
            'scheduled_date'  => $task->scheduled_date?->toDateString(),
            'scheduled_time'  => $task->scheduled_time ? substr($task->scheduled_time, 0, 5) : null,
            'due_by'          => $task->due_by?->toDateString(),
            'estimated_hours' => $task->estimated_hours,
            'customer_forecast' => $customerForecast,
            'job' => $job ? [
                'id'       => $job->id,
                'title'    => $job->title,
                'customer' => $c ? ['id' => $c->id, 'name' => $c->name] : null,
            ] : null,
        ];
    }
}
