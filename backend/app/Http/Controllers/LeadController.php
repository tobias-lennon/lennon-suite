<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Lead::query();

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('phone', 'like', $term)
                  ->orWhere('email', 'like', $term);
            });
        }

        $leads = $query->orderBy('created_at', 'desc')->paginate(25);

        return response()->json($leads);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'   => 'required|string|max:200',
            'phone'  => 'nullable|string|max:30',
            'email'  => 'nullable|email:rfc|max:255',
            'source' => 'nullable|string|in:word_of_mouth,google,instagram,referral,other',
            'status' => 'nullable|string|in:new,contacted,quoted,won,lost',
            'notes'  => 'nullable|string|max:5000',
        ]);

        $lead = Lead::create($data);

        return response()->json($lead, 201);
    }

    public function show(Lead $lead): JsonResponse
    {
        return response()->json($lead->load('convertedCustomer'));
    }

    public function update(Request $request, Lead $lead): JsonResponse
    {
        $data = $request->validate([
            'name'   => 'sometimes|required|string|max:200',
            'phone'  => 'nullable|string|max:30',
            'email'  => 'nullable|email:rfc|max:255',
            'source' => 'nullable|string|in:word_of_mouth,google,instagram,referral,other',
            'status' => 'nullable|string|in:new,contacted,quoted,won,lost',
            'notes'  => 'nullable|string|max:5000',
        ]);

        $lead->update($data);

        return response()->json($lead);
    }

    public function destroy(Lead $lead): JsonResponse
    {
        $lead->delete();

        return response()->json(['message' => 'Lead deleted']);
    }

    public function convert(Lead $lead): JsonResponse
    {
        if ($lead->converted_customer_id) {
            return response()->json([
                'message'     => 'Already converted',
                'customer_id' => $lead->converted_customer_id,
            ]);
        }

        $customer = Customer::create([
            'name'  => $lead->name,
            'phone' => $lead->phone,
            'email' => $lead->email,
            'type'  => 'residential',
            'notes' => $lead->notes,
        ]);

        $lead->update([
            'status'                => 'won',
            'converted_customer_id' => $customer->id,
        ]);

        return response()->json(['customer_id' => $customer->id, 'customer' => $customer], 201);
    }
}
