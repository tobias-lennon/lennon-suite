<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class EmployeeController extends Controller
{
    public function index(): JsonResponse
    {
        $employees = Employee::with('user')
            ->orderBy('name')
            ->get()
            ->map(fn($e) => $this->format($e));

        return response()->json($employees);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'pay_rate' => 'required|numeric|min:0',
            'ppsn'     => 'nullable|string|max:10',
            'email'    => 'nullable|email|unique:users,email',
            'password' => ['nullable', 'string', Password::min(8)],
        ]);

        $employee = DB::transaction(function () use ($data) {
            $userId = null;

            if (!empty($data['email'])) {
                $user = User::create([
                    'name'     => $data['name'],
                    'email'    => $data['email'],
                    'password' => Hash::make($data['password'] ?? str()->random(16)),
                    'role'     => 'field',
                ]);
                $userId = $user->id;
            }

            return Employee::create([
                'name'      => $data['name'],
                'user_id'   => $userId,
                'ppsn'      => $data['ppsn'] ?? null,
                'pay_rate'  => $data['pay_rate'],
                'is_active' => true,
            ]);
        });

        return response()->json($this->format($employee->fresh('user')), 201);
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'name'                    => 'sometimes|string|max:255',
            'pay_rate'                => 'sometimes|numeric|min:0',
            'ppsn'                    => 'sometimes|nullable|string|max:10',
            'is_active'               => 'sometimes|boolean',
            'password'                => ['nullable', 'string', Password::min(8)],
            'employment_start_date'   => 'sometimes|nullable|date',
            'weekly_tax_credits'      => 'sometimes|nullable|numeric|min:0',
            'std_rate_cutoff_weekly'  => 'sometimes|nullable|numeric|min:0',
            'usc_status'              => 'sometimes|in:standard,reduced,exempt',
        ]);

        DB::transaction(function () use ($data, $employee) {
            $employee->update(array_filter([
                'name'                   => $data['name'] ?? null,
                'pay_rate'               => $data['pay_rate'] ?? null,
                'ppsn'                   => $data['ppsn'] ?? null,
                'is_active'              => $data['is_active'] ?? null,
                'employment_start_date'  => $data['employment_start_date'] ?? null,
                'weekly_tax_credits'     => $data['weekly_tax_credits'] ?? null,
                'std_rate_cutoff_weekly' => $data['std_rate_cutoff_weekly'] ?? null,
                'usc_status'             => $data['usc_status'] ?? null,
            ], fn($v) => $v !== null));

            if ($employee->user && !empty($data['name'])) {
                $employee->user->update(['name' => $data['name']]);
            }

            if ($employee->user && !empty($data['password'])) {
                $employee->user->update(['password' => Hash::make($data['password'])]);
            }
        });

        return response()->json($this->format($employee->fresh('user')));
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $employee->update(['is_active' => false]);
        return response()->json(['message' => 'Employee deactivated.']);
    }

    private function format(Employee $e): array
    {
        return [
            'id'                     => $e->id,
            'name'                   => $e->name,
            'ppsn'                   => $e->ppsn,
            'pay_rate'               => $e->pay_rate,
            'is_active'              => $e->is_active,
            'employment_start_date'  => $e->employment_start_date?->format('Y-m-d'),
            'weekly_tax_credits'     => $e->weekly_tax_credits,
            'std_rate_cutoff_weekly' => $e->std_rate_cutoff_weekly,
            'usc_status'             => $e->usc_status ?? 'standard',
            'user'                   => $e->user ? [
                'id'    => $e->user->id,
                'email' => $e->user->email,
            ] : null,
        ];
    }
}
