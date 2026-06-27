<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\Payslip;
use App\Models\PayrollRun;
use App\Models\WorkLogEntry;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PayrollController extends Controller
{
    public function index(): JsonResponse
    {
        $runs = PayrollRun::withCount('payslips')
            ->orderByDesc('period_start')
            ->get()
            ->map(fn($r) => $this->formatRun($r));

        return response()->json($runs);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_start' => 'required|date',
            'period_end'   => 'required|date|after_or_equal:period_start',
            'pay_date'     => 'required|date',
        ]);

        $run = PayrollRun::create($data);

        foreach (Employee::where('is_active', true)->get() as $employee) {
            $hoursLogged = WorkLogEntry::where('employee_id', $employee->id)
                ->whereHas('workLog', fn($q) => $q->whereBetween('date', [$data['period_start'], $data['period_end']]))
                ->sum('billable_hours');

            $calc = $this->calculate($employee, (float) $hoursLogged);

            Payslip::create([
                'payroll_run_id'    => $run->id,
                'employee_id'       => $employee->id,
                'hours_logged'      => $hoursLogged,
                'hours_extra'       => 0,
                'extra_description' => null,
                ...$calc,
            ]);
        }

        $run->load('payslips.employee.user');
        return response()->json($this->formatRunWithPayslips($run), 201);
    }

    public function show(PayrollRun $run): JsonResponse
    {
        $run->load('payslips.employee.user');
        return response()->json($this->formatRunWithPayslips($run));
    }

    public function updatePayslip(Request $request, PayrollRun $run, Payslip $payslip): JsonResponse
    {
        abort_if($run->status === 'finalised', 422, 'Cannot edit a finalised pay run.');
        abort_if($payslip->payroll_run_id !== $run->id, 404);

        $data = $request->validate([
            'hours_extra'       => 'sometimes|numeric|min:0',
            'extra_description' => 'nullable|string|max:255',
        ]);

        $hoursExtra = array_key_exists('hours_extra', $data) ? (float) $data['hours_extra'] : $payslip->hours_extra;
        $calc = $this->calculate($payslip->employee, $payslip->hours_logged + $hoursExtra);

        $payslip->update([
            'hours_extra'       => $hoursExtra,
            'extra_description' => $data['extra_description'] ?? $payslip->extra_description,
            ...$calc,
        ]);

        return response()->json($this->formatPayslip($payslip->fresh('employee.user')));
    }

    public function finalise(PayrollRun $run): JsonResponse
    {
        abort_if($run->status === 'finalised', 422, 'Already finalised.');

        $run->update(['status' => 'finalised']);
        $run->load('payslips.employee.user');

        return response()->json($this->formatRunWithPayslips($run));
    }

    public function destroy(PayrollRun $run): JsonResponse
    {
        abort_if($run->status === 'finalised', 422, 'Cannot delete a finalised pay run.');
        $run->delete();
        return response()->json(['message' => 'Pay run deleted.']);
    }

    public function downloadPayslipPdf(PayrollRun $run, Payslip $payslip): Response
    {
        abort_if($payslip->payroll_run_id !== $run->id, 404);
        $payslip->load('employee');
        $settings = CompanySetting::instance();

        $pdf = Pdf::loadView('pdf.payslip', compact('payslip', 'run', 'settings'))
            ->setPaper('a4', 'portrait');

        $name   = strtolower(str_replace(' ', '-', $payslip->employee->name));
        $period = $run->period_start->format('Y-m-d');

        return $pdf->download("payslip-{$name}-{$period}.pdf");
    }

    // ── Tax calculation (Irish 2025 rates) ────────────────────────────────────

    private function calculate(Employee $employee, float $hours): array
    {
        $grossPay = round($hours * $employee->pay_rate, 2);

        // PAYE
        $cutoff  = (float) ($employee->std_rate_cutoff_weekly ?? 0);
        $credits = (float) ($employee->weekly_tax_credits ?? 0);
        $rawTax  = min($grossPay, $cutoff) * 0.20 + max(0.0, $grossPay - $cutoff) * 0.40;
        $paye    = round(max(0.0, $rawTax - $credits), 2);

        // PRSI (Class A thresholds)
        if ($grossPay <= 352.0) {
            $prsiEmployee = 0.0;
            $prsiEmployer = round($grossPay * 0.088, 2);
        } else {
            $prsiEmployee = round($grossPay * 0.04, 2);
            $prsiEmployer = round($grossPay * 0.1115, 2);
        }

        // USC (weekly 2025 thresholds)
        $usc = 0.0;
        if ($employee->usc_status !== 'exempt') {
            if ($employee->usc_status === 'reduced') {
                // Medical card: max 2%
                $usc = min($grossPay, 231.00) * 0.005 + max(0.0, $grossPay - 231.00) * 0.02;
            } else {
                $bands     = [[231.00, 0.005], [264.38, 0.02], [851.62, 0.04]];
                $remaining = $grossPay;
                foreach ($bands as [$width, $rate]) {
                    if ($remaining <= 0) break;
                    $usc      += min($remaining, $width) * $rate;
                    $remaining -= $width;
                }
                if ($remaining > 0) $usc += $remaining * 0.08;
            }
            $usc = round($usc, 2);
        }

        return [
            'gross_pay'     => $grossPay,
            'paye'          => $paye,
            'prsi_employee' => $prsiEmployee,
            'prsi_employer' => $prsiEmployer,
            'usc'           => $usc,
            'net_pay'       => round($grossPay - $paye - $prsiEmployee - $usc, 2),
        ];
    }

    // ── Formatters ────────────────────────────────────────────────────────────

    private function formatRun(PayrollRun $run): array
    {
        return [
            'id'            => $run->id,
            'period_start'  => $run->period_start->format('Y-m-d'),
            'period_end'    => $run->period_end->format('Y-m-d'),
            'pay_date'      => $run->pay_date->format('Y-m-d'),
            'status'        => $run->status,
            'payslip_count' => $run->payslips_count ?? $run->payslips->count(),
        ];
    }

    private function formatRunWithPayslips(PayrollRun $run): array
    {
        return [
            ...$this->formatRun($run),
            'payslips' => $run->payslips->map(fn($p) => $this->formatPayslip($p)),
        ];
    }

    private function formatPayslip(Payslip $p): array
    {
        return [
            'id'                => $p->id,
            'employee_id'       => $p->employee_id,
            'employee_name'     => $p->employee->name,
            'employee_ppsn'     => $p->employee->ppsn,
            'hours_logged'      => $p->hours_logged,
            'hours_extra'       => $p->hours_extra,
            'extra_description' => $p->extra_description,
            'hours_total'       => round($p->hours_logged + $p->hours_extra, 2),
            'gross_pay'         => $p->gross_pay,
            'paye'              => $p->paye,
            'prsi_employee'     => $p->prsi_employee,
            'prsi_employer'     => $p->prsi_employer,
            'usc'               => $p->usc,
            'net_pay'           => $p->net_pay,
            'emailed_at'        => $p->emailed_at?->toIso8601String(),
            'has_rpn_data'      => $p->employee->std_rate_cutoff_weekly !== null,
        ];
    }
}
