<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\CustomerFollowup;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerFollowupTest extends TestCase
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
            'loyalty_credit_ex_vat'   => 100.00,
            'target_billable_days'    => 160,
        ]);
    }

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'      => 'Test Customer',
            'type'      => 'residential',
            'is_active' => true,
        ], $attrs));
    }

    private function makeFollowup(Customer $customer, array $attrs = []): CustomerFollowup
    {
        return CustomerFollowup::create(array_merge([
            'customer_id' => $customer->id,
            'note'        => 'Test follow-up note',
        ], $attrs));
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_followup_for_customer(): void
    {
        $customer = $this->makeCustomer();

        $response = $this->actingAs($this->admin)
            ->postJson("/api/customers/{$customer->id}/followups", [
                'note'           => 'Call back next week',
                'follow_up_date' => now()->addDays(7)->toDateString(),
            ])
            ->assertStatus(201)
            ->assertJsonPath('note',        'Call back next week')
            ->assertJsonPath('customer_id', $customer->id);

        $this->assertDatabaseHas('customer_followups', [
            'customer_id' => $customer->id,
            'note'        => 'Call back next week',
        ]);
    }

    public function test_store_note_required_returns_422(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->postJson("/api/customers/{$customer->id}/followups", [
                'follow_up_date' => now()->addDays(3)->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_note_and_resolved_at(): void
    {
        $customer = $this->makeCustomer();
        $followup = $this->makeFollowup($customer, ['note' => 'Original note']);

        $resolvedAt = now()->toDateString();

        $this->actingAs($this->admin)
            ->patchJson("/api/customer-followups/{$followup->id}", [
                'note'        => 'Updated note',
                'resolved_at' => $resolvedAt,
            ])
            ->assertOk()
            ->assertJsonPath('note', 'Updated note');

        $this->assertDatabaseHas('customer_followups', [
            'id'   => $followup->id,
            'note' => 'Updated note',
        ]);

        $freshFollowup = $followup->fresh();
        $this->assertNotNull($freshFollowup->resolved_at);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_followup(): void
    {
        $customer = $this->makeCustomer();
        $followup = $this->makeFollowup($customer);

        $this->actingAs($this->admin)
            ->deleteJson("/api/customer-followups/{$followup->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('customer_followups', ['id' => $followup->id]);
    }

    // ─── upcoming ─────────────────────────────────────────────────────────────

    public function test_upcoming_returns_followups_due_within_7_days_not_resolved(): void
    {
        $customer = $this->makeCustomer();

        // Due in 3 days, unresolved — should appear
        $this->makeFollowup($customer, [
            'note'           => 'Upcoming soon',
            'follow_up_date' => now()->addDays(3)->toDateString(),
            'resolved_at'    => null,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();

        $notes = array_column($response->json(), 'note');
        $this->assertContains('Upcoming soon', $notes);
    }

    public function test_upcoming_excludes_resolved_followups(): void
    {
        $customer = $this->makeCustomer();

        $this->makeFollowup($customer, [
            'note'           => 'Resolved note',
            'follow_up_date' => now()->addDays(2)->toDateString(),
            'resolved_at'    => now(),
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();

        $notes = array_column($response->json(), 'note');
        $this->assertNotContains('Resolved note', $notes);
    }

    public function test_upcoming_excludes_followups_due_beyond_7_days(): void
    {
        $customer = $this->makeCustomer();

        $this->makeFollowup($customer, [
            'note'           => 'Far future note',
            'follow_up_date' => now()->addDays(14)->toDateString(),
            'resolved_at'    => null,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();

        $notes = array_column($response->json(), 'note');
        $this->assertNotContains('Far future note', $notes);
    }

    public function test_upcoming_excludes_followups_with_no_date(): void
    {
        $customer = $this->makeCustomer();

        // No follow_up_date — should not appear in upcoming
        $this->makeFollowup($customer, [
            'note'           => 'No date note',
            'follow_up_date' => null,
            'resolved_at'    => null,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();

        $notes = array_column($response->json(), 'note');
        $this->assertNotContains('No date note', $notes);
    }

    public function test_upcoming_returns_customer_name(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice Murphy']);

        $this->makeFollowup($customer, [
            'note'           => 'Check in',
            'follow_up_date' => now()->addDays(1)->toDateString(),
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();

        $item = $response->json()[0];
        $this->assertEquals('Alice Murphy', $item['customer_name']);
        $this->assertEquals($customer->id,  $item['customer_id']);
    }

    // ─── field role access ────────────────────────────────────────────────────

    public function test_field_can_view_upcoming(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/customer-followups/upcoming')
            ->assertOk();
    }

    public function test_field_cannot_store_followup(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->postJson("/api/customers/{$customer->id}/followups", [
                'note' => 'Test note',
            ])
            ->assertStatus(403);
    }

    public function test_field_cannot_update_followup(): void
    {
        $customer = $this->makeCustomer();
        $followup = $this->makeFollowup($customer);

        $this->actingAs($this->field)
            ->patchJson("/api/customer-followups/{$followup->id}", [
                'note' => 'Changed note',
            ])
            ->assertStatus(403);
    }

    public function test_field_cannot_destroy_followup(): void
    {
        $customer = $this->makeCustomer();
        $followup = $this->makeFollowup($customer);

        $this->actingAs($this->field)
            ->deleteJson("/api/customer-followups/{$followup->id}")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_upcoming_returns_401(): void
    {
        $this->getJson('/api/customer-followups/upcoming')->assertStatus(401);
    }

    public function test_unauthenticated_store_returns_401(): void
    {
        $customer = $this->makeCustomer();

        $this->postJson("/api/customers/{$customer->id}/followups", ['note' => 'Test'])
            ->assertStatus(401);
    }
}
