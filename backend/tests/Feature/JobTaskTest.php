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

class JobTaskTest extends TestCase
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
            'sort_order'   => (int) $j->tasks()->max('sort_order') + 1,
        ], $attrs));
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_task_with_201(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/tasks", ['title' => 'Dig trench'])
            ->assertStatus(201)
            ->assertJsonPath('title', 'Dig trench');

        $this->assertDatabaseHas('job_tasks', ['field_job_id' => $job->id, 'title' => 'Dig trench']);
    }

    public function test_store_first_task_gets_sort_order_1(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/tasks", ['title' => 'First Task'])
            ->assertStatus(201)
            ->assertJsonPath('sort_order', 1);
    }

    public function test_store_second_task_gets_sort_order_2(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        // Create first task directly
        $this->makeTask($job, ['title' => 'Task One', 'sort_order' => 1]);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/tasks", ['title' => 'Task Two'])
            ->assertStatus(201)
            ->assertJsonPath('sort_order', 2);
    }

    public function test_store_requires_title(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/tasks", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_store_rejects_invalid_status(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/tasks", [
                'title'  => 'Bad Status Task',
                'status' => 'not_valid',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_title_and_status(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job, ['title' => 'Old Title', 'status' => 'pending']);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}/tasks/{$task->id}", [
                'title'  => 'Updated Title',
                'status' => 'in_progress',
            ])
            ->assertOk()
            ->assertJsonPath('title', 'Updated Title')
            ->assertJsonPath('status', 'in_progress');

        $this->assertDatabaseHas('job_tasks', [
            'id'     => $task->id,
            'title'  => 'Updated Title',
            'status' => 'in_progress',
        ]);
    }

    public function test_update_task_from_wrong_job_returns_404(): void
    {
        $customer = $this->makeCustomer();
        $jobA     = $this->makeJob($customer, ['title' => 'Job A']);
        $jobB     = $this->makeJob($customer, ['title' => 'Job B']);
        $task     = $this->makeTask($jobA);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$jobB->id}/tasks/{$task->id}", ['title' => 'Cross-job edit'])
            ->assertStatus(404);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_task(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job);

        $this->actingAs($this->admin)
            ->deleteJson("/api/jobs/{$job->id}/tasks/{$task->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('job_tasks', ['id' => $task->id]);
    }

    public function test_destroy_task_from_wrong_job_returns_404(): void
    {
        $customer = $this->makeCustomer();
        $jobA     = $this->makeJob($customer, ['title' => 'Job A']);
        $jobB     = $this->makeJob($customer, ['title' => 'Job B']);
        $task     = $this->makeTask($jobA);

        $this->actingAs($this->admin)
            ->deleteJson("/api/jobs/{$jobB->id}/tasks/{$task->id}")
            ->assertStatus(404);
    }

    // ─── role access ──────────────────────────────────────────────────────────

    public function test_field_role_cannot_store_task(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->postJson("/api/jobs/{$job->id}/tasks", ['title' => 'Unauthorised Task'])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_update_task(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job);

        $this->actingAs($this->field)
            ->patchJson("/api/jobs/{$job->id}/tasks/{$task->id}", ['title' => 'Sneaky Edit'])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_destroy_task(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job);

        $this->actingAs($this->field)
            ->deleteJson("/api/jobs/{$job->id}/tasks/{$task->id}")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->postJson("/api/jobs/{$job->id}/tasks", ['title' => 'Anon Task'])
            ->assertStatus(401);
    }
}
