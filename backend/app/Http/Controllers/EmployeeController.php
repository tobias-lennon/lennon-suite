<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\JsonResponse;

class EmployeeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Employee::where('is_active', true)->orderBy('name')->get()
        );
    }
}
