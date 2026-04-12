<?php

namespace App\Http\Controllers;

use App\Models\FieldJob;
use App\Models\Invoice;
use App\Services\RateCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FieldJob::with([
                'customer:id,name',
                'customer.address:id,customer_id,postcode',
                'invoice:id,field_job_id,invoice_number,status',
            ])
            ->withCount('workLogs');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                  ->orWhereHas('customer', fn($c) => $c->where('name', 'like', $term));
            });
        }

        $sort = $request->get('sort', 'created_at_desc');
        match ($sort) {
            'scheduled_date_asc'  => $query->orderByRaw('scheduled_date IS NULL, scheduled_date ASC'),
            'scheduled_date_desc' => $query->orderByRaw('scheduled_date IS NULL, scheduled_date DESC'),
            'priority_desc'       => $query->orderByRaw("FIELD(priority, 'urgent', 'high', 'normal')"),
            default               => $query->orderBy('created_at', 'desc'),
        };

        return response()->json($query->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'customer_id'       => 'nullable|exists:customers,id|required_unless:type,internal',
            'project_id'        => 'nullable|exists:projects,id',
            'title'             => 'required|string|max:255',
            'description'       => 'nullable|string',
            'type'              => 'required|in:standard,maintenance,site_visit,internal',
            'has_power_tools'   => 'boolean',
            'has_waste_disposal' => 'boolean',
            'status'            => 'in:backlog,scheduled,in_progress,complete',
            'weather_req'       => 'in:any,dry_preferred,dry_only',
            'est_duration'      => 'nullable|in:quick,half_day,full_day,multi_day',
            'priority'          => 'in:normal,high,urgent',
            'scheduled_date'    => 'nullable|date',
            'notes'             => 'nullable|string',
        ]);

        $job = FieldJob::create($data);
        $job->load('customer:id,name');

        return response()->json($job, 201);
    }

    public function show(FieldJob $job): JsonResponse
    {
        $job->load([
            'customer:id,name,phone,email,discount_pct',
            'customer.address',
            'customer.rateCard',
            'project:id,name',
            'workLogs' => fn($q) => $q->orderBy('date', 'desc'),
            'workLogs.entries.employee:id,name',
            'workLogs.materials',
        ]);

        $job->append([]);

        // Add computed totals
        $totals = $this->computeTotals($job);

        // Attach invoice summary if one exists
        $invoice = Invoice::where('field_job_id', $job->id)
            ->select('id', 'invoice_number', 'status', 'total_due', 'issued_date')
            ->first();

        return response()->json(array_merge($job->toArray(), [
            'totals'  => $totals,
            'invoice' => $invoice,
        ]));
    }

    public function update(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'customer_id'        => 'nullable|exists:customers,id',
            'project_id'         => 'nullable|exists:projects,id',
            'title'              => 'sometimes|string|max:255',
            'description'        => 'nullable|string',
            'type'               => 'sometimes|in:standard,maintenance,site_visit,internal',
            'has_power_tools'    => 'boolean',
            'has_waste_disposal' => 'boolean',
            'status'             => 'sometimes|in:backlog,scheduled,in_progress,complete',
            'weather_req'        => 'sometimes|in:any,dry_preferred,dry_only',
            'est_duration'       => 'nullable|in:quick,half_day,full_day,multi_day',
            'priority'           => 'sometimes|in:normal,high,urgent',
            'scheduled_date'     => 'nullable|date',
            'notes'              => 'nullable|string',
        ]);

        $job->update($data);

        return response()->json($job->fresh('customer:id,name'));
    }

    public function updateStatus(Request $request, FieldJob $job): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:backlog,scheduled,in_progress,complete',
        ]);

        $job->update($data);

        return response()->json($job);
    }

    public function destroy(FieldJob $job): JsonResponse
    {
        $job->delete();

        return response()->json(null, 204);
    }

    private function computeTotals(FieldJob $job): array
    {
        $totalHours     = 0;
        $totalCharged   = 0;
        $totalCost      = 0;
        $totalMaterials = 0;

        foreach ($job->workLogs as $log) {
            foreach ($log->entries as $entry) {
                $totalHours   += $entry->billable_hours;
                $totalCharged += $entry->amount_charged;
                $totalCost    += $entry->amount_paid;
            }
            foreach ($log->materials as $material) {
                $totalMaterials += $material->amount_charged;
            }
        }

        $rateService = app(RateCalculationService::class);
        $calloutFee  = $rateService->calculateCalloutFee($job, $totalHours);

        return [
            'total_hours'          => round($totalHours, 2),
            'total_labour_charged' => round($totalCharged, 2),
            'total_labour_cost'    => round($totalCost, 2),
            'total_materials'      => round($totalMaterials, 2),
            'callout_fee'          => round($calloutFee, 2),
            'total_charged'        => round($totalCharged + $totalMaterials + $calloutFee, 2),
            'margin'               => round($totalCharged - $totalCost, 2),
        ];
    }
}
