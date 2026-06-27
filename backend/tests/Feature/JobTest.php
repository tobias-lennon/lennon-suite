<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\FieldJob;
use App\Models\JobTask;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JobTest extends TestCase
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
            'is_active' => true,
        ], $attrs));
    }

    private function makeJob(Customer $c, array $attrs = []): FieldJob
    {
        return FieldJob::create(array_merge([
            'customer_id' => $c->id,
            'title'       => 'Test Job',
            'type'        => 'standard',
            'status'      => 'backlog',
        ], $attrs));
    }

    private function makeTask(FieldJob $j, array $attrs = []): JobTask
    {
        return JobTask::create(array_merge([
            'field_job_id' => $j->id,
            'title'        => 'Test Task',
            'status'       => 'pending',
            'sort_order'   => 1,
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_jobs_excluding_complete_by_default(): void
    {
        $customer = $this->makeCustomer();
        $this->makeJob($customer, ['status' => 'backlog']);
        $this->makeJob($customer, ['status' => 'scheduled']);
        $this->makeJob($customer, ['status' => 'complete']);

        $this->actingAs($this->admin)
            ->getJson('/api/jobs')
            ->assertOk()
            ->assertJsonPath('total', 2);
    }

    public function test_index_status_filter_includes_complete_when_requested(): void
    {
        $customer = $this->makeCustomer();
        $this->makeJob($customer, ['status' => 'backlog']);
        $this->makeJob($customer, ['status' => 'complete']);

        $this->actingAs($this->admin)
            ->getJson('/api/jobs?status=complete')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.status', 'complete');
    }

    public function test_index_type_filter(): void
    {
        $customer = $this->makeCustomer();
        $this->makeJob($customer, ['type' => 'standard']);
        $this->makeJob($customer, ['type' => 'maintenance']);

        $this->actingAs($this->admin)
            ->getJson('/api/jobs?type=maintenance')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.type', 'maintenance');
    }

    public function test_index_customer_id_filter(): void
    {
        $customerA = $this->makeCustomer(['name' => 'Alpha']);
        $customerB = $this->makeCustomer(['name' => 'Beta']);
        $this->makeJob($customerA);
        $this->makeJob($customerB);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs?customer_id={$customerA->id}")
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.customer.id', $customerA->id);
    }

    public function test_index_search_by_title(): void
    {
        $customer = $this->makeCustomer();
        $this->makeJob($customer, ['title' => 'Hedge Trimming']);
        $this->makeJob($customer, ['title' => 'Lawn Mowing']);

        $this->actingAs($this->admin)
            ->getJson('/api/jobs?search=Hedge')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.title', 'Hedge Trimming');
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_job_with_customer_tasks_and_totals(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $this->makeTask($job);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}")
            ->assertOk()
            ->assertJsonPath('id', $job->id)
            ->assertJsonStructure(['customer', 'tasks', 'work_logs', 'totals']);
    }

    public function test_show_totals_total_charged_reflects_zero_with_no_work_logs(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['callout_fee' => 0]);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}")
            ->assertOk()
            ->assertJsonPath('totals.total_charged', 0)
            ->assertJsonPath('totals.total_hours', 0);
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_job_with_201(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'New Fencing Job',
                'type'        => 'standard',
            ])
            ->assertStatus(201)
            ->assertJsonPath('title', 'New Fencing Job');

        $this->assertDatabaseHas('field_jobs', ['title' => 'New Fencing Job']);
    }

    public function test_store_auto_populates_callout_fee_from_customer_default(): void
    {
        $customer = $this->makeCustomer(['default_callout_fee' => 45.00]);

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Callout Job',
                'type'        => 'standard',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'title'       => 'Callout Job',
            'callout_fee' => 45.00,
        ]);
    }

    public function test_store_does_not_auto_populate_callout_fee_when_explicitly_provided(): void
    {
        $customer = $this->makeCustomer(['default_callout_fee' => 45.00]);

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Explicit Fee Job',
                'type'        => 'standard',
                'callout_fee' => 20.00,
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'title'       => 'Explicit Fee Job',
            'callout_fee' => 20.00,
        ]);
    }

    public function test_store_internal_job_does_not_require_customer_id(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'title' => 'Internal Meeting',
                'type'  => 'internal',
            ])
            ->assertStatus(201)
            ->assertJsonPath('type', 'internal');
    }

    public function test_store_internal_job_accepts_optional_customer_id(): void
    {
        $customer = $this->makeCustomer();

        // For internal jobs the customer_id field is optional (required_unless:type,internal).
        // The store controller does not strip it — only update does.
        // Verify a valid internal job with an explicitly provided customer_id is accepted.
        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Internal With Customer',
                'type'        => 'internal',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', ['title' => 'Internal With Customer', 'type' => 'internal']);
    }

    public function test_store_requires_customer_id_for_non_internal_jobs(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'title' => 'No Customer',
                'type'  => 'standard',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['customer_id']);
    }

    public function test_store_requires_type(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'No Type Job',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_store_rejects_invalid_type(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Bad Type Job',
                'type'        => 'invalid_type',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    public function test_store_rejects_invalid_status(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Bad Status Job',
                'type'        => 'standard',
                'status'      => 'not_a_status',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_title(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['title' => 'Old Title']);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}", ['title' => 'New Title'])
            ->assertOk()
            ->assertJsonPath('title', 'New Title');

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'title' => 'New Title']);
    }

    public function test_update_internal_job_forces_customer_id_to_null(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['type' => 'internal']);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}", [
                'type'        => 'internal',
                'customer_id' => $customer->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'customer_id' => null]);
    }

    // ─── updateStatus ─────────────────────────────────────────────────────────

    public function test_update_status_sets_status(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog']);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}/status", ['status' => 'scheduled'])
            ->assertOk()
            ->assertJsonPath('status', 'scheduled');

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'status' => 'scheduled']);
    }

    public function test_update_status_rejects_invalid_status(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}/status", ['status' => 'flying'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->deleteJson("/api/jobs/{$job->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('field_jobs', ['id' => $job->id]);
    }

    // ─── role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_index_jobs(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/jobs')
            ->assertOk();
    }

    public function test_field_role_can_show_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->getJson("/api/jobs/{$job->id}")
            ->assertOk();
    }

    public function test_field_role_can_update_status(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog']);

        $this->actingAs($this->field)
            ->patchJson("/api/jobs/{$job->id}/status", ['status' => 'in_progress'])
            ->assertOk();
    }

    public function test_field_role_cannot_store_job(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->postJson('/api/jobs', [
                'customer_id' => $customer->id,
                'title'       => 'Unauthorised Job',
                'type'        => 'standard',
            ])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_update_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->patchJson("/api/jobs/{$job->id}", ['title' => 'Sneaky Edit'])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_destroy_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->deleteJson("/api/jobs/{$job->id}")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/jobs')->assertStatus(401);
    }
}
