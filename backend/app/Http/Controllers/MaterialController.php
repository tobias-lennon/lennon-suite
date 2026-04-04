<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\WorkLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaterialController extends Controller
{
    public function store(Request $request, WorkLog $log): JsonResponse
    {
        $data = $request->validate([
            'description'    => 'required|string|max:255',
            'qty'            => 'nullable|numeric|min:0',
            'unit'           => 'nullable|string|max:50',
            'cost_paid'      => 'required|numeric|min:0',
            'amount_charged' => 'required|numeric|min:0',
            'notes'          => 'nullable|string',
        ]);

        $material = Material::create(array_merge($data, ['work_log_id' => $log->id]));

        return response()->json($material, 201);
    }

    public function update(Request $request, WorkLog $log, Material $material): JsonResponse
    {
        abort_if($material->work_log_id !== $log->id, 404);

        $data = $request->validate([
            'description'    => 'sometimes|string|max:255',
            'qty'            => 'nullable|numeric|min:0',
            'unit'           => 'nullable|string|max:50',
            'cost_paid'      => 'sometimes|numeric|min:0',
            'amount_charged' => 'sometimes|numeric|min:0',
            'notes'          => 'nullable|string',
        ]);

        $material->update($data);

        return response()->json($material);
    }

    public function destroy(WorkLog $log, Material $material): JsonResponse
    {
        abort_if($material->work_log_id !== $log->id, 404);

        $material->delete();

        return response()->json(null, 204);
    }
}
