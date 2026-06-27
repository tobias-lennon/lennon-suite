<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\FieldJob;
use App\Models\Invoice;
use App\Models\LoyaltyCredit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoyaltyCreditTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => UserRole::ADMIN]);

        CompanySetting::firstOrCreate([], [
            'company_name'            => 'Test Co',
            'vat_rate'                => 13.5,
            'invoice_due_days'        => 30,
            'invoice_prefix'          => 'LL',
            'loyalty_threshold_hours' => 60,
            'loyalty_credit_ex_vat'   => 100.00,
            'target_billable_days'    => 160,
        ]);
    }

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'                      => 'Test Customer',
            'is_active'                 => true,
            'skip_loyalty'              => false,
            'maintenance_hours_balance' => 0,
        ], $attrs));
    }

    private function makeJob(Customer $customer, string $type = 'maintenance'): FieldJob
    {
        return FieldJob::create([
            'customer_id' => $customer->id,
            'title'       => 'Test Job',
            'type'        => $type,
            'status'      => 'complete',
        ]);
    }

    private static int $invoiceSeq = 100;

    private function makeInvoice(Customer $customer, FieldJob $job, array $attrs = []): Invoice
    {
        return Invoice::create(array_merge([
            'invoice_number'         => 'LL-2026-' . (++self::$invoiceSeq),
            'field_job_id'           => $job->id,
            'customer_id'            => $customer->id,
            'issued_date'            => now()->toDateString(),
            'due_date'               => now()->addDays(30)->toDateString(),
            'status'                 => 'draft',
            'subtotal'               => 300.00,
            'discount_pct'           => 0,
            'discount_amount'        => 0,
            'vat_rate'               => 13.5,
            'vat_amount'             => 40.50,
            'total_due'              => 340.50,
            'loyalty_hours_earned'   => 5.0,
            'loyalty_balance_after'  => 19.25,
            'loyalty_credit_applied' => false,
        ], $attrs));
    }

    private function pendingCredit(Customer $customer): LoyaltyCredit
    {
        return LoyaltyCredit::create([
            'customer_id'      => $customer->id,
            'hours_at_trigger' => 60,
            'earned_at'        => now(),
            'type'             => 'invoice_discount',
            'status'           => 'pending',
        ]);
    }

    // ─── applyLoyaltyCredit — existing pending credit path ────────────────────

    public function test_apply_uses_pending_credit_without_changing_balance(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['loyalty_balance_after' => 19.25]);
        $credit   = $this->pendingCredit($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertOk()
            ->assertJsonPath('loyalty_credit_applied', true)
            ->assertJsonPath('can_apply_loyalty_credit', false)
            ->assertJsonPath('has_pending_loyalty_credit', false)
            ->assertJsonPath('customer_loyalty_balance', 19.25);

        $this->assertDatabaseHas('loyalty_credits', [
            'id'                    => $credit->id,
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
        ]);

        // Balance must be untouched — checkMaintenanceLoyalty already deducted 60 when credit was created
        $this->assertDatabaseHas('customers', [
            'id'                       => $customer->id,
            'maintenance_hours_balance' => 19.25,
        ]);
    }

    public function test_apply_with_pending_credit_preserves_loyalty_balance_after_snapshot(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['loyalty_balance_after' => 19.25]);
        $this->pendingCredit($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertOk();

        // Snapshot on invoice must still reflect 19.25 (balance was not changed)
        $this->assertDatabaseHas('invoices', [
            'id'                    => $invoice->id,
            'loyalty_balance_after' => 19.25,
        ]);
    }

    // ─── applyLoyaltyCredit — on-the-fly credit path ──────────────────────────

    public function test_apply_on_the_fly_creates_credit_deducts_balance_and_updates_snapshot(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 75.0]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['loyalty_balance_after' => 75.0]);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertOk()
            ->assertJsonPath('loyalty_credit_applied', true);

        // One applied credit should now exist
        $this->assertDatabaseHas('loyalty_credits', [
            'customer_id'           => $customer->id,
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
        ]);

        // Balance deducted by threshold (75 - 60 = 15)
        $this->assertDatabaseHas('customers', [
            'id'                       => $customer->id,
            'maintenance_hours_balance' => 15.0,
        ]);

        // Snapshot on invoice updated to post-deduction balance
        $this->assertDatabaseHas('invoices', [
            'id'                    => $invoice->id,
            'loyalty_balance_after' => 15.0,
        ]);
    }

    // ─── applyLoyaltyCredit — 422 error cases ─────────────────────────────────

    public function test_apply_returns_422_when_credit_already_applied(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, [
            'loyalty_credit_applied' => true,
            'loyalty_credit_amount'  => 113.14,
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertStatus(422)
            ->assertJsonPath('message', 'A loyalty credit has already been applied to this invoice.');
    }

    public function test_apply_returns_422_for_non_maintenance_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, 'standard');
        $invoice  = $this->makeInvoice($customer, $job, [
            'loyalty_hours_earned'  => null,
            'loyalty_balance_after' => null,
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Loyalty credits only apply to maintenance invoices.');
    }

    public function test_apply_returns_422_when_balance_below_threshold_and_no_pending_credit(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 15.0]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This customer has not yet earned a loyalty credit.');
    }

    // ─── destroy — credit reversal ─────────────────────────────────────────────

    public function test_destroy_reverts_applied_credit_to_pending(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, [
            'loyalty_credit_applied' => true,
            'loyalty_credit_amount'  => 113.14,
            'total_due'              => 56.50,
        ]);

        $credit = LoyaltyCredit::create([
            'customer_id'           => $customer->id,
            'hours_at_trigger'      => 60,
            'earned_at'             => now(),
            'type'                  => 'invoice_discount',
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
            'applied_at'            => now(),
        ]);

        $this->actingAs($this->admin)
            ->deleteJson("/api/invoices/{$invoice->id}")
            ->assertOk();

        $this->assertDatabaseMissing('invoices', ['id' => $invoice->id]);

        $this->assertDatabaseHas('loyalty_credits', [
            'id'                    => $credit->id,
            'status'                => 'pending',
            'applied_to_invoice_id' => null,
            'applied_at'            => null,
        ]);
    }

    public function test_destroy_does_not_restore_customer_balance_when_reverting_credit(): void
    {
        // Balance is 19.25 because checkMaintenanceLoyalty already deducted 60 when
        // the pending credit was created. Restoring it here would double-count.
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, [
            'loyalty_credit_applied' => true,
            'loyalty_credit_amount'  => 113.14,
        ]);

        LoyaltyCredit::create([
            'customer_id'           => $customer->id,
            'hours_at_trigger'      => 60,
            'earned_at'             => now(),
            'type'                  => 'invoice_discount',
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
            'applied_at'            => now(),
        ]);

        $this->actingAs($this->admin)
            ->deleteJson("/api/invoices/{$invoice->id}")
            ->assertOk();

        $this->assertDatabaseHas('customers', [
            'id'                       => $customer->id,
            'maintenance_hours_balance' => 19.25,
        ]);
    }

    // ─── show — skip_loyalty customer gets no loyalty data ────────────────────

    public function test_show_returns_null_loyalty_fields_for_skip_loyalty_customer(): void
    {
        $customer = $this->makeCustomer([
            'skip_loyalty'              => true,
            'maintenance_hours_balance' => 45.0,
        ]);
        $job     = $this->makeJob($customer);
        $invoice = $this->makeInvoice($customer, $job, [
            'loyalty_hours_earned'  => null,
            'loyalty_balance_after' => null,
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', false)
            ->assertJsonPath('has_pending_loyalty_credit', false)
            ->assertJsonPath('customer_loyalty_balance', null)
            ->assertJsonPath('loyalty_credit_value_inc_vat', null)
            ->assertJsonPath('loyalty_credit_ex_vat', null);
    }

    public function test_show_does_not_allow_apply_on_skip_loyalty_customer_even_with_pending_credit(): void
    {
        $customer = $this->makeCustomer([
            'skip_loyalty'              => true,
            'maintenance_hours_balance' => 75.0,
        ]);
        $job = $this->makeJob($customer);
        $this->pendingCredit($customer);
        $invoice = $this->makeInvoice($customer, $job, [
            'loyalty_hours_earned'  => null,
            'loyalty_balance_after' => null,
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', false)
            ->assertJsonPath('has_pending_loyalty_credit', false);
    }

    // ─── show — loyalty fields for enrolled customer ───────────────────────────

    public function test_show_returns_can_apply_true_when_pending_credit_exists(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);
        $this->pendingCredit($customer);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', true)
            ->assertJsonPath('has_pending_loyalty_credit', true)
            ->assertJsonPath('customer_loyalty_balance', 19.25);
    }

    public function test_show_returns_can_apply_true_when_balance_meets_threshold(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 65.0]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', true)
            ->assertJsonPath('has_pending_loyalty_credit', false)
            ->assertJsonPath('customer_loyalty_balance', 65);
    }

    public function test_show_returns_can_apply_false_when_balance_below_threshold_and_no_pending(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 15.0]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', false)
            ->assertJsonPath('has_pending_loyalty_credit', false)
            ->assertJsonPath('customer_loyalty_balance', 15);
    }

    public function test_show_returns_can_apply_false_after_credit_already_applied(): void
    {
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, [
            'loyalty_credit_applied' => true,
            'loyalty_credit_amount'  => 113.14,
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('can_apply_loyalty_credit', false);
    }

    // ─── Balance invariant ─────────────────────────────────────────────────────

    public function test_balance_invariant_holds_after_on_the_fly_apply(): void
    {
        // 75 total earned. After on-the-fly apply: balance = 15, 0 pending credits
        // Invariant: balance + 60 × pending_count = 75
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 75.0]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job);

        $this->actingAs($this->admin)
            ->postJson("/api/invoices/{$invoice->id}/apply-loyalty")
            ->assertOk();

        $customer->refresh();
        $pendingCount  = LoyaltyCredit::where('customer_id', $customer->id)->where('status', 'pending')->count();
        $appliedCount  = LoyaltyCredit::where('customer_id', $customer->id)->where('status', 'applied')->count();
        $reconstructed = $customer->maintenance_hours_balance + (60 * ($pendingCount + $appliedCount));

        $this->assertEqualsWithDelta(75.0, $reconstructed, 0.01);
    }

    public function test_balance_invariant_holds_after_destroy_reverts_credit(): void
    {
        // Total earned = 19.25 (current balance) + 60 (the applied credit) = 79.25
        $customer = $this->makeCustomer(['maintenance_hours_balance' => 19.25]);
        $job      = $this->makeJob($customer);
        $invoice  = $this->makeInvoice($customer, $job, ['loyalty_credit_applied' => true]);

        LoyaltyCredit::create([
            'customer_id'           => $customer->id,
            'hours_at_trigger'      => 60,
            'earned_at'             => now(),
            'type'                  => 'invoice_discount',
            'status'                => 'applied',
            'applied_to_invoice_id' => $invoice->id,
            'applied_at'            => now(),
        ]);

        $this->actingAs($this->admin)
            ->deleteJson("/api/invoices/{$invoice->id}")
            ->assertOk();

        $customer->refresh();
        $pendingCount  = LoyaltyCredit::where('customer_id', $customer->id)->where('status', 'pending')->count();
        $appliedCount  = LoyaltyCredit::where('customer_id', $customer->id)->where('status', 'applied')->count();
        $reconstructed = $customer->maintenance_hours_balance + (60 * ($pendingCount + $appliedCount));

        // Invariant: 19.25 + 60 × 1 (now pending) = 79.25 — same as before destroy
        $this->assertEqualsWithDelta(79.25, $reconstructed, 0.01);
    }
}
