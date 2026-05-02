<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Contact::query();

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('company_name', 'like', $term)
                  ->orWhere('specialty', 'like', $term)
                  ->orWhere('phone', 'like', $term)
                  ->orWhere('email', 'like', $term);
            });
        }

        $contacts = $query->orderBy('name')->paginate(25);

        return response()->json($contacts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'         => 'required|string|in:supplier_company,supplier_individual,tradesman,other',
            'name'         => 'required|string|max:200',
            'company_name' => 'nullable|string|max:200',
            'specialty'    => 'nullable|string|max:100',
            'phone'        => 'nullable|string|max:30',
            'email'        => 'nullable|email:rfc|max:255',
            'day_rate'     => 'nullable|numeric|min:0',
            'notes'        => 'nullable|string|max:5000',
            'is_active'    => 'nullable|boolean',
        ]);

        $contact = Contact::create($data);

        return response()->json($contact, 201);
    }

    public function show(Contact $contact): JsonResponse
    {
        return response()->json($contact);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        $data = $request->validate([
            'type'         => 'sometimes|required|string|in:supplier_company,supplier_individual,tradesman,other',
            'name'         => 'sometimes|required|string|max:200',
            'company_name' => 'nullable|string|max:200',
            'specialty'    => 'nullable|string|max:100',
            'phone'        => 'nullable|string|max:30',
            'email'        => 'nullable|email:rfc|max:255',
            'day_rate'     => 'nullable|numeric|min:0',
            'notes'        => 'nullable|string|max:5000',
            'is_active'    => 'nullable|boolean',
        ]);

        $contact->update($data);

        return response()->json($contact);
    }

    public function destroy(Contact $contact): JsonResponse
    {
        $contact->delete();

        return response()->json(['message' => 'Contact deleted']);
    }
}
