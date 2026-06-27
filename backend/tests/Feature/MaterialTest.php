<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\FieldJob;
use App\Models\Material;
use App\Models\User;
use App\Models\WorkLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MaterialTest extends TestCase
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

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'      => 'Test Customer',
            'is_active' => true,
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

    private function makeWorkLog(FieldJob $job, array $attrs = []): WorkLog
    {
        return WorkLog::create(array_merge([
            'field_job_id' => $job->id,
            'date'         => '2026-06-01',
        ], $attrs));
    }

    private function makeMaterial(WorkLog $log, array $attrs = []): Material
    {
        return Material::create(array_merge([
            'work_log_id'    => $log->id,
            'description'    => 'Bark mulch',
            'cost_paid'      => 20.00,
            'amount_charged' => 30.00,
        ], $attrs));
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_material_in_log(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/materials", [
                'description'    => 'Gravel bags',
                'cost_paid'      => 45.00,
                'amount_charged' => 70.00,
            ])
            ->assertStatus(201)
            ->assertJsonPath('description', 'Gravel bags')
            ->assertJsonPath('work_log_id', $log->id);

        $this->assertDatabaseHas('materials', [
            'work_log_id' => $log->id,
            'description' => 'Gravel bags',
            'cost_paid'   => 45.00,
        ]);
    }

    public function test_store_requires_description(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/materials", [
                'cost_paid'      => 20.00,
                'amount_charged' => 30.00,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['description']);
    }

    public function test_store_requires_cost_paid(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/materials", [
                'description'    => 'Gravel',
                'amount_charged' => 30.00,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['cost_paid']);
    }

    public function test_store_requires_amount_charged(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->admin)
            ->postJson("/api/logs/{$log->id}/materials", [
                'description' => 'Gravel',
                'cost_paid'   => 20.00,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['amount_charged']);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_description_and_amount_charged(): void
    {
        $customer  = $this->makeCustomer();
        $job       = $this->makeJob($customer);
        $log       = $this->makeWorkLog($job);
        $material  = $this->makeMaterial($log, ['description' => 'Old name', 'amount_charged' => 30.00]);

        $this->actingAs($this->admin)
            ->patchJson("/api/logs/{$log->id}/materials/{$material->id}", [
                'description'    => 'New name',
                'amount_charged' => 55.00,
            ])
            ->assertOk()
            ->assertJsonPath('description', 'New name')
            ->assertJsonPath('amount_charged', 55);

        $this->assertDatabaseHas('materials', [
            'id'             => $material->id,
            'description'    => 'New name',
            'amount_charged' => 55.00,
        ]);
    }

    public function test_update_material_from_wrong_log_returns_404(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logA      = $this->makeWorkLog($jobA);
        $logB      = $this->makeWorkLog($jobB);
        $material  = $this->makeMaterial($logA);

        $this->actingAs($this->admin)
            ->patchJson("/api/logs/{$logB->id}/materials/{$material->id}", [
                'description' => 'Hijack attempt',
            ])
            ->assertNotFound();
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $material = $this->makeMaterial($log);

        $this->actingAs($this->admin)
            ->deleteJson("/api/logs/{$log->id}/materials/{$material->id}")
            ->assertStatus(204);

        $this->assertDatabaseMissing('materials', ['id' => $material->id]);
    }

    public function test_destroy_material_from_wrong_log_returns_404(): void
    {
        $customer  = $this->makeCustomer();
        $jobA      = $this->makeJob($customer);
        $jobB      = $this->makeJob($customer, ['title' => 'Other Job']);
        $logA      = $this->makeWorkLog($jobA);
        $logB      = $this->makeWorkLog($jobB);
        $material  = $this->makeMaterial($logA);

        $this->actingAs($this->admin)
            ->deleteJson("/api/logs/{$logB->id}/materials/{$material->id}")
            ->assertNotFound();
    }

    // ─── Role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_store_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->actingAs($this->field)
            ->postJson("/api/logs/{$log->id}/materials", [
                'description'    => 'Field topsoil',
                'cost_paid'      => 30.00,
                'amount_charged' => 50.00,
            ])
            ->assertStatus(201);
    }

    public function test_field_role_can_update_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $material = $this->makeMaterial($log);

        $this->actingAs($this->field)
            ->patchJson("/api/logs/{$log->id}/materials/{$material->id}", [
                'amount_charged' => 45.00,
            ])
            ->assertOk();
    }

    public function test_field_role_can_destroy_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $material = $this->makeMaterial($log);

        $this->actingAs($this->field)
            ->deleteJson("/api/logs/{$log->id}/materials/{$material->id}")
            ->assertStatus(204);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_store_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);

        $this->postJson("/api/logs/{$log->id}/materials", [
            'description'    => 'Gravel',
            'cost_paid'      => 20.00,
            'amount_charged' => 30.00,
        ])
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_update_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $material = $this->makeMaterial($log);

        $this->patchJson("/api/logs/{$log->id}/materials/{$material->id}", [
            'amount_charged' => 99.00,
        ])
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_destroy_material(): void
    {
        $customer = $this->makeCustomer();
        $job      = $this->makeJob($customer);
        $log      = $this->makeWorkLog($job);
        $material = $this->makeMaterial($log);

        $this->deleteJson("/api/logs/{$log->id}/materials/{$material->id}")
            ->assertStatus(401);
    }
}
