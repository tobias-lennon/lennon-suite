<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerFollowup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerFollowupController extends Controller
{
    public function store(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'note'           => 'required|string|max:1000',
            'follow_up_date' => 'nullable|date',
        ]);

        $followup = $customer->followups()->create($data);

        return response()->json($this->format($followup), 201);
    }

    public function update(Request $request, CustomerFollowup $followup): JsonResponse
    {
        $data = $request->validate([
            'note'           => 'sometimes|string|max:1000',
            'follow_up_date' => 'nullable|date',
            'resolved_at'    => 'nullable|date',
        ]);

        $followup->update($data);

        return response()->json($this->format($followup->fresh()));
    }

    public function destroy(CustomerFollowup $followup): JsonResponse
    {
        $followup->delete();

        return response()->json(null, 204);
    }

    public function upcoming(): JsonResponse
    {
        $followups = CustomerFollowup::with('customer:id,name')
            ->whereNull('resolved_at')
            ->whereNotNull('follow_up_date')
            ->where('follow_up_date', '<=', now()->addDays(7)->toDateString())
            ->orderBy('follow_up_date')
            ->get()
            ->map(fn($f) => [
                'id'             => $f->id,
                'note'           => $f->note,
                'follow_up_date' => $f->follow_up_date?->toDateString(),
                'customer_id'    => $f->customer_id,
                'customer_name'  => $f->customer?->name,
            ]);

        return response()->json($followups);
    }

    private function format(CustomerFollowup $f): array
    {
        return [
            'id'             => $f->id,
            'customer_id'    => $f->customer_id,
            'note'           => $f->note,
            'follow_up_date' => $f->follow_up_date?->toDateString(),
            'resolved_at'    => $f->resolved_at?->toISOString(),
            'created_at'     => $f->created_at?->toISOString(),
        ];
    }
}
