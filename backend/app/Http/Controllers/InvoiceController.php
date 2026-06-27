<?php

namespace App\Http\Controllers;

use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\LoyaltyCredit;
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
        return response()->json($this->buildInvoiceResponse($invoice));
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

        return response()->json($this->buildInvoiceResponse($invoice->fresh()));
    }

    public function updateStatus(Request $request, Invoice $invoice): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:draft,sent,paid',
        ]);

        $invoice->update(['status' => $data['status']]);

        return response()->json($invoice->fresh());
    }

    public function applyLoyaltyCredit(Invoice $invoice): JsonResponse
    {
        $invoice->load('job:id,type');

        if ($invoice->job?->type !== 'maintenance') {
            return response()->json(['message' => 'Loyalty credits only apply to maintenance invoices.'], 422);
        }

        if ($invoice->loyalty_credit_applied) {
            return response()->json(['message' => 'A loyalty credit has already been applied to this invoice.'], 422);
        }

        $settings = CompanySetting::instance();
        $customer = Customer::find($invoice->customer_id);

        $hasPendingCredit = LoyaltyCredit::where('customer_id', $invoice->customer_id)
            ->where('status', 'pending')
            ->exists();

        if (!$customer || (!$hasPendingCredit && $customer->maintenance_hours_balance < $settings->loyalty_threshold_hours)) {
            return response()->json(['message' => 'This customer has not yet earned a loyalty credit.'], 422);
        }

        // Find existing pending credit (auto-fired by checkMaintenanceLoyalty — balance already deducted)
        $credit = LoyaltyCredit::where('customer_id', $invoice->customer_id)
            ->where('status', 'pending')
            ->orderBy('earned_at')
            ->first();

        if ($credit) {
            // checkMaintenanceLoyalty already subtracted the threshold from the balance — don't touch it
        } else {
            // No auto-fired credit: create one on the fly and deduct from balance now
            $credit = LoyaltyCredit::create([
                'customer_id'      => $invoice->customer_id,
                'hours_at_trigger' => $customer->maintenance_hours_balance,
                'earned_at'        => now(),
                'type'             => 'invoice_discount',
                'status'           => 'pending',
            ]);

            $customer->maintenance_hours_balance = max(
                0,
                round($customer->maintenance_hours_balance - $settings->loyalty_threshold_hours, 2)
            );
            $customer->save();
        }

        $creditExVat  = (float) $settings->loyalty_credit_ex_vat;
        $creditIncVat = round($creditExVat * (1 + $invoice->vat_rate / 100), 2);
        $discount     = round(min($creditIncVat, $invoice->total_due), 2);

        $invoice->update([
            'loyalty_credit_applied' => true,
            'loyalty_credit_amount'  => $discount,
            'total_due'              => max(0, round($invoice->total_due - $discount, 2)),
            'loyalty_balance_after'  => round((float) $customer->maintenance_hours_balance, 2),
        ]);

        $credit->update([
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
            'applied_at'            => now(),
        ]);

        return response()->json($this->buildInvoiceResponse($invoice->fresh()));
    }

    public function destroy(Invoice $invoice): JsonResponse
    {
        // Reverse any applied loyalty credit before deletion
        if ($invoice->loyalty_credit_applied) {
            $credit = LoyaltyCredit::where('applied_to_invoice_id', $invoice->id)
                ->where('status', 'applied')
                ->first();

            if ($credit) {
                // Revert credit to pending so it can be applied to another invoice.
                // Do NOT restore the balance — the pending credit already represents
                // those 60 deducted points (checkMaintenanceLoyalty deducted them when
                // the credit was first earned). Adding 60 back would double-count.
                $credit->update([
                    'status'                => 'pending',
                    'applied_to_invoice_id' => null,
                    'applied_at'            => null,
                ]);
            }
        }

        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted']);
    }

    private function buildInvoiceResponse(Invoice $invoice): array
    {
        $invoice->loadMissing(['lineItems', 'customer.address', 'job:id,title,type']);

        $canApplyLoyalty   = false;
        $hasPendingCredit  = false;
        $creditValueIncVat = null;
        $creditValueExVat  = null;
        $customerBalance   = null;

        if ($invoice->job?->type === 'maintenance') {
            $settings = CompanySetting::instance();
            $customer = Customer::find($invoice->customer_id);

            if ($customer && !$customer->skip_loyalty) {
                $creditValueExVat  = (float) $settings->loyalty_credit_ex_vat;
                $creditValueIncVat = round($creditValueExVat * (1 + $invoice->vat_rate / 100), 2);
                $customerBalance   = $customer->maintenance_hours_balance;

                $hasPendingCredit = LoyaltyCredit::where('customer_id', $invoice->customer_id)
                    ->where('status', 'pending')
                    ->exists();

                $canApplyLoyalty = !$invoice->loyalty_credit_applied
                    && ($hasPendingCredit || $customer->maintenance_hours_balance >= $settings->loyalty_threshold_hours);
            }
        }

        $data = $invoice->toArray();
        $data['can_apply_loyalty_credit']     = $canApplyLoyalty;
        $data['has_pending_loyalty_credit']   = $hasPendingCredit;
        $data['loyalty_credit_value_inc_vat'] = $creditValueIncVat;
        $data['loyalty_credit_ex_vat']        = $creditValueExVat;
        $data['customer_loyalty_balance']     = $customerBalance;

        return $data;
    }

    public function downloadPdf(Invoice $invoice): Response
    {
        $invoice->load(['lineItems', 'customer.address', 'job:id,title,type']);
        $settings = CompanySetting::instance();

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice'  => $invoice,
            'type'     => 'invoice',
            'settings' => $settings,
        ])->setPaper('a4', 'portrait');

        return $pdf->download("INV-{$invoice->invoice_number}.pdf");
    }

    public function downloadReceipt(Invoice $invoice): Response
    {
        if ($invoice->status !== 'paid') {
            abort(422, 'Invoice is not yet marked as paid.');
        }

        $invoice->load(['lineItems', 'customer.address', 'job:id,title,type']);
        $settings = CompanySetting::instance();

        $pdf = Pdf::loadView('pdf.invoice', [
            'invoice'  => $invoice,
            'type'     => 'receipt',
            'settings' => $settings,
        ])->setPaper('a4', 'portrait');

        return $pdf->download("REC-{$invoice->invoice_number}.pdf");
    }
}
