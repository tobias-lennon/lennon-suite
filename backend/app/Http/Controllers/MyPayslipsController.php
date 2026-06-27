<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\Payslip;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class MyPayslipsController extends Controller
{
    public function index(): JsonResponse
    {
        $employee = Employee::where('user_id', Auth::id())->first();

        if (!$employee) {
            return response()->json([]);
        }

        $payslips = Payslip::with('payrollRun')
            ->where('employee_id', $employee->id)
            ->whereHas('payrollRun', fn($q) => $q->where('status', 'finalised'))
            ->orderByDesc('id')
            ->get()
            ->map(fn($p) => [
                'id'           => $p->id,
                'period_start' => $p->payrollRun->period_start->format('Y-m-d'),
                'period_end'   => $p->payrollRun->period_end->format('Y-m-d'),
                'pay_date'     => $p->payrollRun->pay_date->format('Y-m-d'),
                'hours_total'  => round($p->hours_logged + $p->hours_extra, 2),
                'gross_pay'    => $p->gross_pay,
                'net_pay'      => $p->net_pay,
                'emailed_at'   => $p->emailed_at?->toIso8601String(),
            ]);

        return response()->json($payslips);
    }

    public function downloadPdf(Payslip $payslip): Response
    {
        $employee = Employee::where('user_id', Auth::id())->firstOrFail();
        abort_if($payslip->employee_id !== $employee->id, 403);

        $payslip->load(['employee', 'payrollRun']);
        abort_if($payslip->payrollRun->status !== 'finalised', 403);

        $run      = $payslip->payrollRun;
        $settings = CompanySetting::instance();

        $pdf = Pdf::loadView('pdf.payslip', compact('payslip', 'run', 'settings'))
            ->setPaper('a4', 'portrait');

        return $pdf->download("payslip-{$run->period_start->format('Y-m-d')}.pdf");
    }
}
