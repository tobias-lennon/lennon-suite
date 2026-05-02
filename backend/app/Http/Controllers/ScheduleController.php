<?php

namespace App\Http\Controllers;

use App\Models\FieldJob;
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

        $forecastsByCoords = $this->buildForecastsMap(
            $scheduled->merge($overdue)->merge($unscheduled)
        );

        return response()->json([
            'week_start'  => $weekStart->toDateString(),
            'week_end'    => $weekEnd->toDateString(),
            'scheduled'   => $scheduled->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
            'overdue'     => $overdue->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
            'unscheduled' => $unscheduled->map(fn($j) => $this->jobSummary($j, $forecastsByCoords))->values(),
        ]);
    }

    public function updateDate(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'scheduled_date' => 'nullable|date',
        ]);

        $job->update(['scheduled_date' => $data['scheduled_date']]);

        $fresh = $job->fresh()->load('customer:id,name,minutes_from_hq,latitude,longitude');
        $forecastsByCoords = $this->buildForecastsMap(collect([$fresh]));

        return response()->json($this->jobSummary($fresh, $forecastsByCoords));
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
                'id'             => $c->id,
                'name'           => $c->name,
                'minutes_from_hq' => $c->minutes_from_hq,
            ] : null,
        ];
    }
}
