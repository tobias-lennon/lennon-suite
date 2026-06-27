<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\FieldJob;
use App\Models\User;
use App\Models\WorkLog;
use App\Services\RateCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkLogTest extends TestCase
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

        // Mock RateCalculationService so tests never need a rate card in the DB
        $this->mock(RateCalculationService::class, function ($mock) {
            $mock->shouldReceive('calculateRate')->andReturn(45.00)->byDefault();
            $mock->shouldReceive('checkMaintenanceLoyalty')->andReturn(null)->byDefault();
            $mock->shouldReceive('reverseMaintenanceLoyalty')->andReturn(null)->byDefault();
        });
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'                      => 'Test Customer',
            'is_active'                 => true,
            'skip_loyalty'              => false,
            'maintenance_hours_balance' => 0,
        ], $attrs));
    }

    private function makeJob(Customer $customer, array $attrs = []): FieldJob
    {
        return FieldJob::create(array_merge([
            'customer_id' => $customer->id,
            'title'       => 'Test Job',
            'type'        => 'standard',
            'status'      => 'backlog',
        ], $attrs));
    }

    private function makeEmployee(array $attrs = []): Employee
    {
        return Employee::create(array_merge([
            'name'      => 'Test Worker',
            'pay_rate'  => 15.00,
            'is_active' => true,
        ], $attrs));
    }

    private function makeWorkLog(FieldJob $job, array $attrs = []): WorkLog
    {
        return WorkLog::create(array_merge([
            'field_job_id' => $job->id,
            'date'         => '2026-06-01',
            'notes'        => 'Test notes',
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_work_logs_for_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $this->makeWorkLog($job, ['notes' => 'Day one']);
        $this->makeWorkLog($job, ['date' => '2026-06-02', 'notes' => 'Day two']);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}/logs")
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_index_returns_empty_array_when_job_has_no_logs(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}/logs")
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_index_includes_entries_and_materials(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $employee = $this->makeEmployee();
        $log      = $this->makeWorkLog($job);

        \App\Models\WorkLogEntry::create([
            'work_log_id'    => $log->id,
            'employee_id'    => $employee->id,
            'billable_hours' => 3.0,
            'rate_per_hour'  => 45.00,
            'pay_rate'       => 15.00,
            'discount_pct'   => 0,
            'amount_charged' => 135.00,
            'amount_paid'    => 45.00,
            'margin'         => 90.00,
        ]);

        \App\Models\Material::create([
            'work_log_id'    => $log->id,
            'description'    => 'Bark mulch',
            'cost_paid'      => 20.00,
            'amount_charged' => 30.00,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}/logs")
            ->assertOk();

        $this->assertNotEmpty($response->json('0.entries'));
        $this->assertNotEmpty($response->json('0.materials'));
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_work_log_for_correct_job(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job, ['notes' => 'Specific log']);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$job->id}/logs/{$log->id}")
            ->assertOk()
            ->assertJsonPath('id', $log->id)
            ->assertJsonPath('notes', 'Specific log');
    }

    public function test_show_returns_404_if_log_belongs_to_different_job(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logForJobA = $this->makeWorkLog($jobA);

        $this->actingAs($this->admin)
            ->getJson("/api/jobs/{$jobB->id}/logs/{$logForJobA->id}")
            ->assertNotFound();
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_work_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", [
                'date'  => '2026-06-15',
                'notes' => 'Created via API',
            ])
            ->assertStatus(201)
            ->assertJsonPath('notes', 'Created via API');

        $this->assertDatabaseHas('work_logs', [
            'field_job_id' => $job->id,
            'notes'        => 'Created via API',
        ]);
    }

    public function test_store_requires_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", ['notes' => 'Missing date'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['date']);
    }

    public function test_store_transitions_job_from_backlog_to_in_progress(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog']);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'id'     => $job->id,
            'status' => 'in_progress',
        ]);
    }

    public function test_store_transitions_job_from_scheduled_to_in_progress(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'scheduled']);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'id'     => $job->id,
            'status' => 'in_progress',
        ]);
    }

    public function test_store_does_not_change_status_if_job_already_in_progress(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'in_progress']);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'id'     => $job->id,
            'status' => 'in_progress',
        ]);
    }

    public function test_store_does_not_change_status_if_job_is_complete(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'complete']);

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(201);

        $this->assertDatabaseHas('field_jobs', [
            'id'     => $job->id,
            'status' => 'complete',
        ]);
    }

    public function test_store_creates_nested_entries_and_materials(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $employee = $this->makeEmployee();

        $this->actingAs($this->admin)
            ->postJson("/api/jobs/{$job->id}/logs", [
                'date'    => '2026-06-15',
                'entries' => [
                    [
                        'employee_id'    => $employee->id,
                        'billable_hours' => 4.0,
                    ],
                ],
                'materials' => [
                    [
                        'description'    => 'Gravel',
                        'cost_paid'      => 50.00,
                        'amount_charged' => 80.00,
                    ],
                ],
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('work_log_entries', ['employee_id' => $employee->id, 'billable_hours' => 4.0]);
        $this->assertDatabaseHas('materials', ['description' => 'Gravel', 'cost_paid' => 50.00]);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_date_and_notes(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job, ['date' => '2026-06-01', 'notes' => 'Original']);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$job->id}/logs/{$log->id}", [
                'date'  => '2026-06-10',
                'notes' => 'Updated',
            ])
            ->assertOk()
            ->assertJsonPath('notes', 'Updated');

        $this->assertDatabaseHas('work_logs', [
            'id'    => $log->id,
            'notes' => 'Updated',
        ]);
    }

    public function test_update_returns_404_if_log_belongs_to_different_job(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logForJobA = $this->makeWorkLog($jobA);

        $this->actingAs($this->admin)
            ->patchJson("/api/jobs/{$jobB->id}/logs/{$logForJobA->id}", ['notes' => 'Hijack'])
            ->assertNotFound();
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_work_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->deleteJson("/api/jobs/{$job->id}/logs/{$log->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('work_logs', ['id' => $log->id]);
    }

    public function test_destroy_returns_404_if_log_belongs_to_different_job(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logForJobA = $this->makeWorkLog($jobA);

        $this->actingAs($this->admin)
            ->deleteJson("/api/jobs/{$jobB->id}/logs/{$logForJobA->id}")
            ->assertNotFound();
    }

    // ─── Role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_index_logs(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->getJson("/api/jobs/{$job->id}/logs")
            ->assertOk();
    }

    public function test_field_role_can_show_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->field)
            ->getJson("/api/jobs/{$job->id}/logs/{$log->id}")
            ->assertOk();
    }

    public function test_field_role_can_store_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->actingAs($this->field)
            ->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(201);
    }

    public function test_field_role_can_update_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->field)
            ->patchJson("/api/jobs/{$job->id}/logs/{$log->id}", ['notes' => 'Field edit'])
            ->assertOk();
    }

    public function test_field_role_can_destroy_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->field)
            ->deleteJson("/api/jobs/{$job->id}/logs/{$log->id}")
            ->assertStatus(204);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_index_logs(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->getJson("/api/jobs/{$job->id}/logs")
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_store_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);

        $this->postJson("/api/jobs/{$job->id}/logs", ['date' => '2026-06-15'])
            ->assertStatus(401);
    }
}
