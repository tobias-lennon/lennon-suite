<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\FieldJob;
use App\Models\JobTask;
use App\Models\User;
use App\Services\WeatherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ScheduleTest extends TestCase
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

        // Prevent real HTTP calls from WeatherService in all schedule tests
        $this->mock(WeatherService::class, function ($mock) {
            $mock->shouldReceive('getForecast')->andReturn([]);
        });
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

    // ─── week endpoint ────────────────────────────────────────────────────────

    public function test_week_returns_scheduled_overdue_and_unscheduled_keys(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/schedule')
            ->assertOk()
            ->assertJsonStructure(['week_start', 'week_end', 'scheduled', 'overdue', 'unscheduled']);
    }

    public function test_week_defaults_to_current_monday(): void
    {
        $expectedMonday = Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();

        $this->actingAs($this->admin)
            ->getJson('/api/schedule')
            ->assertOk()
            ->assertJsonPath('week_start', $expectedMonday);
    }

    public function test_week_with_week_start_param_returns_that_weeks_data(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/schedule?week_start=2026-06-16')
            ->assertOk()
            ->assertJsonPath('week_start', '2026-06-16');
    }

    public function test_job_scheduled_within_queried_week_appears_in_scheduled(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, [
            'status'         => 'scheduled',
            'scheduled_date' => '2026-06-17',
        ]);

        $this->actingAs($this->admin)
            ->getJson('/api/schedule?week_start=2026-06-16')
            ->assertOk()
            ->assertJsonFragment(['id' => $job->id]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/schedule?week_start=2026-06-16')
            ->assertOk();

        $scheduledIds = collect($response->json('scheduled'))->pluck('id')->toArray();
        $this->assertContains($job->id, $scheduledIds);
    }

    public function test_job_with_past_scheduled_date_appears_in_overdue(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, [
            'status'         => 'scheduled',
            'scheduled_date' => '2026-01-01',
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/schedule?week_start=2026-06-16')
            ->assertOk();

        $overdueIds = collect($response->json('overdue'))->pluck('id')->toArray();
        $this->assertContains($job->id, $overdueIds);
    }

    public function test_job_with_no_scheduled_date_appears_in_unscheduled(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog', 'scheduled_date' => null]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/schedule?week_start=2026-06-16')
            ->assertOk();

        $unscheduledIds = collect($response->json('unscheduled'))->pluck('id')->toArray();
        $this->assertContains($job->id, $unscheduledIds);
    }

    // ─── updateDate ───────────────────────────────────────────────────────────

    public function test_update_date_sets_scheduled_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'scheduled', 'scheduled_date' => '2026-06-10']);

        $this->actingAs($this->admin)
            ->patchJson("/api/schedule/jobs/{$job->id}/date", ['scheduled_date' => '2026-06-20'])
            ->assertOk()
            ->assertJsonPath('scheduled_date', '2026-06-20');

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'scheduled_date' => '2026-06-20']);
    }

    public function test_update_date_null_transitions_scheduled_to_backlog(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'scheduled', 'scheduled_date' => '2026-06-17']);

        $this->actingAs($this->admin)
            ->patchJson("/api/schedule/jobs/{$job->id}/date", ['scheduled_date' => null])
            ->assertOk()
            ->assertJsonPath('status', 'backlog')
            ->assertJsonPath('scheduled_date', null);

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'status' => 'backlog', 'scheduled_date' => null]);
    }

    public function test_update_date_setting_date_on_backlog_job_transitions_to_scheduled(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog', 'scheduled_date' => null]);

        $this->actingAs($this->admin)
            ->patchJson("/api/schedule/jobs/{$job->id}/date", ['scheduled_date' => '2026-06-25'])
            ->assertOk()
            ->assertJsonPath('status', 'scheduled')
            ->assertJsonPath('scheduled_date', '2026-06-25');

        $this->assertDatabaseHas('field_jobs', ['id' => $job->id, 'status' => 'scheduled', 'scheduled_date' => '2026-06-25']);
    }

    // ─── updateTaskDate ───────────────────────────────────────────────────────

    public function test_update_task_date_sets_task_scheduled_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job);

        $this->actingAs($this->admin)
            ->patchJson("/api/schedule/tasks/{$task->id}/date", ['scheduled_date' => '2026-06-22'])
            ->assertOk()
            ->assertJsonPath('scheduled_date', '2026-06-22');

        $this->assertDatabaseHas('job_tasks', ['id' => $task->id, 'scheduled_date' => '2026-06-22']);
    }

    public function test_update_task_date_can_clear_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job, ['scheduled_date' => '2026-06-17']);

        $this->actingAs($this->admin)
            ->patchJson("/api/schedule/tasks/{$task->id}/date", ['scheduled_date' => null])
            ->assertOk()
            ->assertJsonPath('scheduled_date', null);

        $this->assertDatabaseHas('job_tasks', ['id' => $task->id, 'scheduled_date' => null]);
    }

    // ─── role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_access_week_endpoint(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/schedule')
            ->assertOk();
    }

    public function test_field_role_can_update_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer, ['status' => 'backlog']);

        $this->actingAs($this->field)
            ->patchJson("/api/schedule/jobs/{$job->id}/date", ['scheduled_date' => '2026-06-25'])
            ->assertOk();
    }

    public function test_field_role_can_update_task_date(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $task     = $this->makeTask($job);

        $this->actingAs($this->field)
            ->patchJson("/api/schedule/tasks/{$task->id}/date", ['scheduled_date' => '2026-06-25'])
            ->assertOk();
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/schedule')->assertStatus(401);
    }
}
