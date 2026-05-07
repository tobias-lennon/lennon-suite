<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\InvoiceGenerationService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class InvoiceController extends Controller
{
    public function __construct(private InvoiceGenerationService $invoiceService) {}

    public function index(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer:id,name', 'job:id,title'])
            ->orderBy('issued_date', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate(25));
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

        $job = \App\Models\FieldJob::findOrFail($data['field_job_id']);
        if ($job->type === 'internal') {
            return response()->json(['message' => 'Internal jobs cannot be invoiced.'], 422);
        }

        $invoice = $this->invoiceService->generate(
            jobId:   $data['field_job_id'],
            dueDays: $data['due_days'] ?? null,
            notes:   $data['notes'] ?? null,
        );

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
