<?php

namespace App\Services;

use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\FieldJob;
use App\Models\LoyaltyCredit;
use App\Models\RateCard;

class RateCalculationService
{
    public function resolveRateCard(Customer $customer): RateCard
    {
        if ($customer->rateCard) {
            return $customer->rateCard;
        }

        $default = RateCard::where('is_active', true)->orderBy('id')->first();

        if (!$default) {
            throw new \RuntimeException('No active rate card found. Please create a rate card first.');
        }

        return $default;
    }

    public function calculateRate(FieldJob $job, Customer $customer, bool $hasPowerTools = false, bool $hasWasteDisposal = false): float
    {
        // Custom rate overrides the rate card entirely — no uplifts or discounts on top
        if (!empty($customer->custom_rate) && $customer->custom_rate > 0) {
            return round((float) $customer->custom_rate, 2);
        }

        $card = $this->resolveRateCard($customer);

        if ($job->type === 'maintenance') {
            $rate = $card->maintenance_rate;
        } else {
            $rate = $card->base_rate;
            if ($hasPowerTools) {
                $rate += $card->power_tool_uplift;
            }
            if ($hasWasteDisposal) {
                $rate += $card->waste_uplift;
            }
        }

        // Discount is NOT applied here — the invoice applies it to the subtotal,
        // keeping line-item rates clean and avoiding double-discounting.
        return round($rate, 2);
    }

    /**
     * Callout fee applies to non-maintenance, non-internal jobs
     * where total billable hours are at or below the threshold.
     */
    public function calculateCalloutFee(FieldJob $job, float $totalHours): float
    {
        if (in_array($job->type, ['maintenance', 'internal'])) {
            return 0.0;
        }

        if (!$job->customer) {
            return 0.0;
        }

        $card = $this->resolveRateCard($job->customer);

        if ($card->callout_fee <= 0) {
            return 0.0;
        }

        $threshold = $card->callout_threshold_hours ?? 4.0;

        if ($totalHours <= $threshold) {
            return round($card->callout_fee, 2);
        }

        return 0.0;
    }

    public function checkMaintenanceLoyalty(Customer $customer, float $hoursAdded): void
    {
        if ($customer->skip_loyalty) {
            return;
        }

        $card = $this->resolveRateCard($customer);
        if ($card->skip_loyalty) {
            return;
        }

        $customer->maintenance_hours_balance += $hoursAdded;
        $threshold = (int) CompanySetting::get('loyalty_threshold_hours', 60);

        while ($customer->maintenance_hours_balance >= $threshold) {
            LoyaltyCredit::create([
                'customer_id'      => $customer->id,
                'hours_at_trigger' => $customer->maintenance_hours_balance,
                'earned_at'        => now(),
                'type'             => 'invoice_discount',
                'status'           => 'pending',
            ]);

            $customer->maintenance_hours_balance -= $threshold;
        }

        $customer->save();
    }

    public function reverseMaintenanceLoyalty(Customer $customer, float $hoursToRemove): void
    {
        if ($customer->skip_loyalty) {
            return;
        }

        $card = $this->resolveRateCard($customer);
        if ($card->skip_loyalty) {
            return;
        }

        $customer->maintenance_hours_balance = max(
            0,
            round($customer->maintenance_hours_balance - $hoursToRemove, 2)
        );
        $customer->save();
    }
}
