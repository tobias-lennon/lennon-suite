<?php

namespace App\Services;

use App\Models\CompanySetting;
use App\Models\FieldJob;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;

class InvoiceGenerationService
{
    public function generate(int $jobId, ?int $dueDays = null, ?string $notes = null): Invoice
    {
        $job = FieldJob::with([
            'customer',
            'workLogs' => fn($q) => $q->orderBy('date'),
            'workLogs.entries.employee:id,name',
            'workLogs.materials',
        ])->findOrFail($jobId);

        $lineItems = $this->buildLineItems($job);

        $subtotal       = round(collect($lineItems)->sum('amount'), 2);
        $discountPct    = (float) ($job->customer?->discount_pct ?? 0);
        $discountAmount = round($subtotal * ($discountPct / 100), 2);
        $vatBase        = round($subtotal - $discountAmount, 2);
        $vatRate        = (float) CompanySetting::get('vat_rate', 13.5);
        $vatAmount      = round($vatBase * ($vatRate / 100), 2);
        $totalDue       = round($vatBase + $vatAmount, 2);

        $resolvedDueDays = $dueDays ?? (int) CompanySetting::get('invoice_due_days', 30);

        [$loyaltyHoursEarned, $loyaltyBalanceAfter] = $this->loyaltySnapshot($job);

        return DB::transaction(function () use (
            $job, $notes, $lineItems, $subtotal, $discountPct, $discountAmount,
            $vatRate, $vatAmount, $totalDue, $resolvedDueDays,
            $loyaltyHoursEarned, $loyaltyBalanceAfter
        ) {
            $invoice = Invoice::create([
                'invoice_number'        => $this->generateInvoiceNumber(),
                'field_job_id'          => $job->id,
                'customer_id'           => $job->customer_id,
                'issued_date'           => now()->toDateString(),
                'due_date'              => now()->addDays($resolvedDueDays)->toDateString(),
                'status'                => 'draft',
                'subtotal'              => $subtotal,
                'discount_pct'          => $discountPct,
                'discount_amount'       => $discountAmount,
                'vat_rate'              => $vatRate,
                'vat_amount'            => $vatAmount,
                'total_due'             => $totalDue,
                'notes'                 => $notes,
                'loyalty_hours_earned'  => $loyaltyHoursEarned,
                'loyalty_balance_after' => $loyaltyBalanceAfter,
            ]);

            foreach ($lineItems as $item) {
                $invoice->lineItems()->create($item);
            }

            return $invoice;
        });
    }

    private function buildLineItems(FieldJob $job): array
    {
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

        return $lineItems;
    }

    private function loyaltySnapshot(FieldJob $job): array
    {
        if ($job->type !== 'maintenance' || !$job->customer) {
            return [null, null];
        }

        $hoursEarned  = round(
            $job->workLogs->flatMap->entries->sum(fn($e) => (float) $e->billable_hours),
            2
        );
        $balanceAfter = round((float) $job->customer->maintenance_hours_balance, 2);

        return [$hoursEarned, $balanceAfter];
    }

    private function generateInvoiceNumber(): string
    {
        $year   = now()->year;
        $prefix = CompanySetting::get('invoice_prefix', 'LL');

        $maxSeq = Invoice::selectRaw("MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) as max_seq")
            ->value('max_seq');

        $nextNum = max((int) $maxSeq + 1, 103);

        return "{$prefix}-{$year}-" . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
    }
}
