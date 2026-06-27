<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\FieldJob;
use App\Models\User;
use App\Models\WorkLog;
use App\Models\WorkLogEntry;
use App\Services\RateCalculationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkLogEntryTest extends TestCase
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
            'status'      => 'in_progress',
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
        ], $attrs));
    }

    private function makeEntry(WorkLog $log, Employee $employee, array $attrs = []): WorkLogEntry
    {
        return WorkLogEntry::create(array_merge([
            'work_log_id'    => $log->id,
            'employee_id'    => $employee->id,
            'billable_hours' => 4.0,
            'rate_per_hour'  => 45.00,
            'pay_rate'       => 15.00,
            'discount_pct'   => 0,
            'amount_charged' => 180.00,
            'amount_paid'    => 60.00,
            'margin'         => 120.00,
        ], $attrs));
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_entry_in_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/entries", [
                'employee_id'    => $employee->id,
                'billable_hours' => 3.5,
            ])
            ->assertStatus(201)
            ->assertJsonPath('work_log_id', $log->id)
            ->assertJsonPath('billable_hours', 3.5);

        $this->assertDatabaseHas('work_log_entries', [
            'work_log_id'    => $log->id,
            'employee_id'    => $employee->id,
            'billable_hours' => 3.5,
        ]);
    }

    public function test_store_requires_employee_id(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/entries", ['billable_hours' => 3.0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['employee_id']);
    }

    public function test_store_requires_billable_hours(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/entries", ['employee_id' => $employee->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['billable_hours']);
    }

    public function test_store_billable_hours_must_be_at_least_zero(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/entries", [
                'employee_id'    => $employee->id,
                'billable_hours' => -1,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['billable_hours']);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_billable_hours(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee, ['billable_hours' => 4.0]);

        $this->actingAs($this->admin)
            ->patchJson("/api/logs/{$log->id}/entries/{$entry->id}", [
                'billable_hours' => 6.0,
            ])
            ->assertOk()
            ->assertJsonPath('billable_hours', 6);

        $this->assertDatabaseHas('work_log_entries', [
            'id'             => $entry->id,
            'billable_hours' => 6.0,
        ]);
    }

    public function test_update_entry_from_wrong_log_returns_404(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logA      = $this->makeWorkLog($jobA);
        $logB      = $this->makeWorkLog($jobB);
        $employee  = $this->makeEmployee();
        $entryInA  = $this->makeEntry($logA, $employee);

        $this->actingAs($this->admin)
            ->patchJson("/api/logs/{$logB->id}/entries/{$entryInA->id}", [
                'billable_hours' => 2.0,
            ])
            ->assertNotFound();
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee);

        $this->actingAs($this->admin)
            ->deleteJson("/api/logs/{$log->id}/entries/{$entry->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('work_log_entries', ['id' => $entry->id]);
    }

    public function test_destroy_entry_from_wrong_log_returns_404(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logA      = $this->makeWorkLog($jobA);
        $logB      = $this->makeWorkLog($jobB);
        $employee  = $this->makeEmployee();
        $entryInA  = $this->makeEntry($logA, $employee);

        $this->actingAs($this->admin)
            ->deleteJson("/api/logs/{$logB->id}/entries/{$entryInA->id}")
            ->assertNotFound();
    }

    // ─── Role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_store_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();

        $this->actingAs($this->field)
            ->postJson("/api/logs/{$log->id}/entries", [
                'employee_id'    => $employee->id,
                'billable_hours' => 2.0,
            ])
            ->assertStatus(201);
    }

    public function test_field_role_can_update_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee);

        $this->actingAs($this->field)
            ->patchJson("/api/logs/{$log->id}/entries/{$entry->id}", [
                'billable_hours' => 5.0,
            ])
            ->assertOk();
    }

    public function test_field_role_can_destroy_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee);

        $this->actingAs($this->field)
            ->deleteJson("/api/logs/{$log->id}/entries/{$entry->id}")
            ->assertStatus(204);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_store_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();

        $this->postJson("/api/logs/{$log->id}/entries", [
            'employee_id'    => $employee->id,
            'billable_hours' => 2.0,
        ])
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_update_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee);

        $this->patchJson("/api/logs/{$log->id}/entries/{$entry->id}", [
            'billable_hours' => 1.0,
        ])
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_destroy_entry(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $employee = $this->makeEmployee();
        $entry    = $this->makeEntry($log, $employee);

        $this->deleteJson("/api/logs/{$log->id}/entries/{$entry->id}")
            ->assertStatus(401);
    }
}
