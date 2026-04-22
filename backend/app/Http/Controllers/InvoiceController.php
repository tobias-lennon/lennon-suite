<?php

namespace App\Http\Controllers;

use App\Models\FieldJob;
use App\Models\Invoice;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    private function generateInvoiceNumber(): string
    {
        $year = now()->year;

        // Extract only the sequence segment (after the last dash) — avoids picking up year digits
        $maxSeq = Invoice::selectRaw("MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) as max_seq")
            ->value('max_seq');

        // Start from at least 103 to pick up from existing business numbering
        $nextNum = max((int) $maxSeq + 1, 103);

        return "LL-{$year}-" . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer:id,name', 'job:id,title'])
            ->orderBy('issued_date', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $invoices = $query->paginate(25);

        return response()->json($invoices);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        $invoice->load(['lineItems', 'customer.address', 'job:id,title,type']);

        return response()->json($invoice);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'field_job_id' => 'required|integer|exists:field_jobs,id',
            'notes'        => 'nullable|string|max:1000',
            'due_days'     => 'nullable|integer|min:1|max:365',
        ]);

        if (Invoice::where('field_job_id', $data['field_job_id'])->exists()) {
            return response()->json(['message' => 'This job has already been invoiced.'], 422);
        }

        $job = FieldJob::with([
            'customer',
            'workLogs' => fn($q) => $q->orderBy('date'),
            'workLogs.entries.employee:id,name',
            'workLogs.materials',
        ])->findOrFail($data['field_job_id']);

        // Build line items — callout fee is job-level, charged once per visit
        $jobCalloutFee = (float) ($job->callout_fee ?? 0);
        $lineItems = [];
        foreach ($job->workLogs as $log) {
            if ($jobCalloutFee > 0) {
                $lineItems[] = [
                    'type'        => 'callout',
                    'description' => 'Callout fee — ' . $log->date->format('d/m/Y'),
                    'quantity'    => 1,
                    'unit_price'  => $jobCalloutFee,
                    'amount'      => $jobCalloutFee,
                ];
            }
            foreach ($log->entries as $entry) {
                $lineItems[] = [
                    'type'        => 'labour',
                    'description' => $entry->employee->name . ' — ' . $log->date->format('d/m/Y'),
                    'quantity'    => (float) $entry->billable_hours,
                    'unit_price'  => (float) $entry->rate_per_hour,
                    'amount'      => (float) $entry->amount_charged,
                ];
            }
            foreach ($log->materials as $material) {
                if ($material->amount_charged > 0) {
                    $qty  = $material->qty ?? 1;
                    $desc = $material->description;
                    if ($material->qty) {
                        $desc .= " ({$material->qty}" . ($material->unit ? " {$material->unit}" : '') . ')';
                    }
                    $lineItems[] = [
                        'type'        => 'material',
                        'description' => $desc,
                        'quantity'    => (float) $qty,
                        'unit_price'  => round($material->amount_charged / max((float) $qty, 1), 2),
                        'amount'      => (float) $material->amount_charged,
                    ];
                }
            }
        }

        $subtotal       = round(collect($lineItems)->sum('amount'), 2);
        $discountPct    = (float) ($job->customer?->discount_pct ?? 0);
        $discountAmount = round($subtotal * ($discountPct / 100), 2);
        $vatBase        = round($subtotal - $discountAmount, 2);
        $vatRate        = 13.5;
        $vatAmount      = round($vatBase * ($vatRate / 100), 2);
        $totalDue       = round($vatBase + $vatAmount, 2);

        // Snapshot loyalty data for maintenance jobs
        $loyaltyHoursEarned  = null;
        $loyaltyBalanceAfter = null;
        if ($job->type === 'maintenance' && $job->customer) {
            $loyaltyHoursEarned  = round(
                $job->workLogs->flatMap->entries->sum(fn($e) => (float) $e->billable_hours),
                2
            );
            $loyaltyBalanceAfter = round((float) $job->customer->maintenance_hours_balance, 2);
        }

        $invoice = DB::transaction(function () use ($job, $data, $lineItems, $subtotal, $discountPct, $discountAmount, $vatRate, $vatAmount, $totalDue, $loyaltyHoursEarned, $loyaltyBalanceAfter) {
            $invoice = Invoice::create([
                'invoice_number'       => $this->generateInvoiceNumber(),
                'field_job_id'         => $job->id,
                'customer_id'          => $job->customer_id,
                'issued_date'          => now()->toDateString(),
                'due_date'             => now()->addDays($data['due_days'] ?? 30)->toDateString(),
                'status'               => 'draft',
                'subtotal'             => $subtotal,
                'discount_pct'         => $discountPct,
                'discount_amount'      => $discountAmount,
                'vat_rate'             => $vatRate,
                'vat_amount'           => $vatAmount,
                'total_due'            => $totalDue,
                'notes'                => $data['notes'] ?? null,
                'loyalty_hours_earned' => $loyaltyHoursEarned,
                'loyalty_balance_after'=> $loyaltyBalanceAfter,
            ]);

            foreach ($lineItems as $item) {
                $invoice->lineItems()->create($item);
            }

            return $invoice;
        });

        return response()->json($invoice->load(['lineItems', 'customer', 'job']), 201);
    }

    public function recordPayment(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'amount_paid'    => 'required|numeric|min:0',
            'payment_method' => 'required|in:cash,bank_transfer',
            'paid_at'        => 'required|date',
            'payment_notes'  => 'nullable|string|max:500',
        ]);

        $invoice->update([
            'amount_paid'    => $data['amount_paid'],
            'payment_method' => $data['payment_method'],
            'paid_at'        => $data['paid_at'],
            'payment_notes'  => $data['payment_notes'] ?? null,
            'status'         => 'paid',
        ]);

        return response()->json($invoice->fresh()->load(['lineItems', 'customer.address', 'job']));
    }

    public function updateStatus(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:draft,sent,paid',
        ]);

        $invoice->update(['status' => $data['status']]);

        return response()->json($invoice->fresh());
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted']);
    }

    public function downloadPdf(Invoice $invoice): Response
    {
        $invoice->load(['lineItems', 'customer.address', 'job:id,title,type']);

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'type'    => 'invoice',
        ])->setPaper('a4', 'portrait');

        return $pdf->download("invoice-{$invoice->invoice_number}.pdf");
    }

    public function downloadReceipt(Invoice $invoice): Response
    {
        if ($invoice->status !== 'paid') {
            abort(422, 'Invoice is not yet marked as paid.');
        }

        $invoice->load(['lineItems', 'customer.address', 'job:id,title,type']);

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            'type'    => 'receipt',
        ])->setPaper('a4', 'portrait');

        return $pdf->download("receipt-{$invoice->invoice_number}.pdf");
    }
}
