<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\FieldJob;
use App\Models\Invoice;
use App\Models\RateCard;
use App\Models\User;
use App\Models\WorkLog;
use App\Models\WorkLogEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $field;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => UserRole::ADMIN]);
        $this->field = User::factory()->create(['role' => UserRole::FIELD]);

        CompanySetting::firstOrCreate([], [
            'company_name'            => 'Test Co',
            'vat_rate'                => 13.5,
            'invoice_due_days'        => 30,
            'invoice_prefix'          => 'LL',
            'loyalty_threshold_hours' => 60,
            'loyalty_credit_ex_vat'   => 251.10,
            'target_billable_days'    => 160,
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function makeRateCard(array $attrs = []): RateCard
    {
        return RateCard::create(array_merge([
            'name'             => 'Standard',
            'base_rate'        => 45.00,
            'maintenance_rate' => 40.00,
            'is_active'        => true,
            'skip_loyalty'     => false,
        ], $attrs));
    }

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'                      => 'Test Customer',
            'is_active'                 => true,
            'skip_loyalty'              => false,
            'maintenance_hours_balance' => 0,
            'discount_pct'              => 0,
        ], $attrs));
    }

    private function makeJob(Customer $customer, array $attrs = []): FieldJob
    {
        return FieldJob::create(array_merge([
            'customer_id' => $customer->id,
            'title'       => 'Test Job',
            'type'        => 'standard',
            'status'      => 'complete',
        ], $attrs));
    }

    private function makeEmployee(array $attrs = []): Employee
    {
        return Employee::create(array_merge([
            'name'      => 'Worker',
            'pay_rate'  => 15.00,
            'is_active' => true,
        ], $attrs));
    }

    private function makeWorkLogWithEntry(FieldJob $job, Employee $employee, float $hours = 4.0, float $ratePerHour = 45.00): WorkLog
    {
        $log = WorkLog::create([
            'field_job_id' => $job->id,
            'date'         => '2026-06-01',
        ]);

        WorkLogEntry::create([
            'work_log_id'    => $log->id,
            'employee_id'    => $employee->id,
            'billable_hours' => $hours,
            'rate_per_hour'  => $ratePerHour,
            'pay_rate'       => $employee->pay_rate,
            'discount_pct'   => 0,
            'amount_charged' => round($hours * $ratePerHour, 2),
            'amount_paid'    => round($hours * $employee->pay_rate, 2),
            'margin'         => round(($hours * $ratePerHour) - ($hours * $employee->pay_rate), 2),
        ]);

        return $log;
    }

    private static int $invoiceSeq = 200;

    private function makeInvoice(Customer $customer, FieldJob $job, array $attrs = []): Invoice
    {
        return Invoice::create(array_merge([
            'invoice_number'         => 'LL-2026-' . (++self::$invoiceSeq),
            'field_job_id'           => $job->id,
            'customer_id'            => $customer->id,
            'issued_date'            => now()->toDateString(),
            'due_date'               => now()->addDays(30)->toDateString(),
            'status'                 => 'draft',
            'subtotal'               => 180.00,
            'discount_pct'           => 0,
            'discount_amount'        => 0,
            'vat_rate'               => 13.5,
            'vat_amount'             => 24.30,
            'total_due'              => 204.30,
            'loyalty_credit_applied' => false,
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_invoices_with_customer_and_job(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $this->makeInvoice($customer, $job);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/invoices')
            ->assertOk();

        $this->assertArrayHasKey('data', $response->json());
        $this->assertNotEmpty($response->json('data'));
        $this->assertNotNull($response->json('data.0.customer'));
        $this->assertNotNull($response->json('data.0.job'));
    }

    public function test_index_filters_by_status_draft(): void
    {
        $rateCard  = $this->makeRateCard();
        $customer  = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $jobA      = $this->makeJob($customer, ['title' => 'Job A']);
        $jobB      = $this->makeJob($customer, ['title' => 'Job B']);
        $this->makeInvoice($customer, $jobA, ['status' => 'draft']);
        $this->makeInvoice($customer, $jobB, ['status' => 'paid']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/invoices?status=draft')
            ->assertOk();

        $statuses = collect($response->json('data'))->pluck('status')->unique()->values()->toArray();
        $this->assertSame(['draft'], $statuses);
    }

    public function test_index_filters_by_status_paid(): void
    {
        $rateCard  = $this->makeRateCard();
        $customer  = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $jobA      = $this->makeJob($customer, ['title' => 'Job A']);
        $jobB      = $this->makeJob($customer, ['title' => 'Job B']);
        $this->makeInvoice($customer, $jobA, ['status' => 'draft']);
        $this->makeInvoice($customer, $jobB, ['status' => 'paid']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/invoices?status=paid')
            ->assertOk();

        $statuses = collect($response->json('data'))->pluck('status')->unique()->values()->toArray();
        $this->assertSame(['paid'], $statuses);
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_invoice_with_line_items_and_loyalty_flags(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk();

        // Loyalty flags are always present in the response (via buildInvoiceResponse)
        $this->assertArrayHasKey('can_apply_loyalty_credit', $response->json());
        $this->assertArrayHasKey('has_pending_loyalty_credit', $response->json());
        $this->assertArrayHasKey('line_items', $response->json());
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_invoice_from_valid_job(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $employee = $this->makeEmployee();
        $this->makeWorkLogWithEntry($job, $employee, 4.0, 45.00);

        $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(201)
            ->assertJsonPath('status', 'draft');

        $this->assertDatabaseHas('invoices', ['field_job_id' => $job->id]);
    }

    public function test_store_creates_invoice_with_correct_totals(): void
    {
        $rateCard = $this->makeRateCard(['base_rate' => 45.00]);
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id, 'discount_pct' => 0]);
        $job      = $this->makeJob($customer);
        $employee = $this->makeEmployee(['pay_rate' => 15.00]);

        // 4 hours @ €45/hr = €180 subtotal
        // VAT at 13.5% = €24.30
        // Total = €204.30
        $this->makeWorkLogWithEntry($job, $employee, 4.0, 45.00);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(201);

        $this->assertEqualsWithDelta(180.00, $response->json('subtotal'), 0.01);
        $this->assertEqualsWithDelta(13.5,   $response->json('vat_rate'), 0.01);
        $this->assertEqualsWithDelta(24.30,  $response->json('vat_amount'), 0.01);
        $this->assertEqualsWithDelta(204.30, $response->json('total_due'), 0.01);
    }

    public function test_store_creates_labour_line_items(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $employee = $this->makeEmployee();
        $this->makeWorkLogWithEntry($job, $employee, 4.0, 45.00);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(201);

        $lineItemTypes = collect($response->json('line_items'))->pluck('type')->toArray();
        $this->assertContains('labour', $lineItemTypes);
    }

    public function test_store_on_already_invoiced_job_returns_422(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This job has already been invoiced.');
    }

    public function test_store_on_internal_job_returns_422(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['type' => 'internal']);

        $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Internal jobs cannot be invoiced.');
    }

    public function test_store_requires_field_job_id(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/invoices', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['field_job_id']);
    }

    public function test_store_field_job_id_must_exist(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/invoices', ['field_job_id' => 99999])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['field_job_id']);
    }

    // ─── recordPayment ────────────────────────────────────────────────────────

    public function test_record_payment_sets_status_to_paid(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['status' => 'sent', 'total_due' => 204.30]);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'amount_paid'    => 204.30,
                'payment_method' => 'bank_transfer',
                'paid_at'        => '2026-06-20',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'paid');

        $this->assertDatabaseHas('invoices', [
            'id'             => $invoice->id,
            'status'         => 'paid',
            'amount_paid'    => 204.30,
            'payment_method' => 'bank_transfer',
        ]);
    }

    public function test_record_payment_requires_amount_paid(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'payment_method' => 'cash',
                'paid_at'        => '2026-06-20',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['amount_paid']);
    }

    public function test_record_payment_method_must_be_cash_or_bank_transfer(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'amount_paid'    => 100.00,
                'payment_method' => 'bitcoin',
                'paid_at'        => '2026-06-20',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }

    public function test_record_payment_requires_paid_at(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'amount_paid'    => 100.00,
                'payment_method' => 'cash',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['paid_at']);
    }

    // ─── updateStatus ─────────────────────────────────────────────────────────

    public function test_update_status_changes_status(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['status' => 'draft']);

        $this->actingAs($this->admin)
            ->patchJson("/api/invoices/{$invoice->id}/status", ['status' => 'sent'])
            ->assertOk()
            ->assertJsonPath('status', 'sent');

        $this->assertDatabaseHas('invoices', [
            'id'     => $invoice->id,
            'status' => 'sent',
        ]);
    }

    public function test_update_status_invalid_value_returns_422(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->patchJson("/api/invoices/{$invoice->id}/status", ['status' => 'cancelled'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_invoice(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->deleteJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Invoice deleted');

        $this->assertDatabaseMissing('invoices', ['id' => $invoice->id]);
    }

    // ─── downloadReceipt ──────────────────────────────────────────────────────

    public function test_download_receipt_on_unpaid_invoice_returns_422(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['status' => 'sent']);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}/receipt")
            ->assertStatus(422);
    }

    // ─── Role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_index_invoices(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/invoices')
            ->assertOk();
    }

    public function test_field_role_can_show_invoice(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->field)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk();
    }

    public function test_field_role_cannot_store_invoice(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_destroy_invoice(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->field)
            ->deleteJson("/api/invoices/{$invoice->id}")
            ->assertStatus(403);
    }

    public function test_field_role_cannot_record_payment(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->field)
            ->postJson("/api/invoices/{$invoice->id}/payment", [
                'amount_paid'    => 100.00,
                'payment_method' => 'cash',
                'paid_at'        => '2026-06-20',
            ])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_update_status(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->field)
            ->patchJson("/api/invoices/{$invoice->id}/status", ['status' => 'sent'])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_apply_loyalty(): void
    {
        $rateCard = $this->makeRateCard();
        $customer = $this->makeCustomer(['rate_card_id' => $rateCard->id]);
        $job      = $this->makeJob($customer, ['type' => 'maintenance']);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->field)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertStatus(403);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_index_invoices(): void
    {
        $this->getJson('/api/invoices')
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_store_invoice(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->postJson('/api/invoices', ['field_job_id' => $job->id])
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_show_invoice(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->getJson("/api/invoices/{$invoice->id}")
            ->assertStatus(401);
    }
}
