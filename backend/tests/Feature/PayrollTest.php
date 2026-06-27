<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\Payslip;
use App\Models\PayrollRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $field;
    private Employee $employeeOne;
    private Employee $employeeTwo;

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

        $this->employeeOne = $this->makeEmployee(['name' => 'Alice Tester']);
        $this->employeeTwo = $this->makeEmployee(['name' => 'Bob Tester']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function makeEmployee(array $attrs = []): Employee
    {
        return Employee::create(array_merge([
            'name'                   => 'Test Employee',
            'pay_rate'               => 15.00,
            'is_active'              => true,
            'weekly_tax_credits'     => 100.00,
            'std_rate_cutoff_weekly' => 600.00,
            'usc_status'             => 'standard',
        ], $attrs));
    }

    private function makeRun(array $attrs = []): PayrollRun
    {
        return PayrollRun::create(array_merge([
            'period_start' => '2026-06-01',
            'period_end'   => '2026-06-07',
            'pay_date'     => '2026-06-10',
            'status'       => 'draft',
        ], $attrs));
    }

    private function makePayslip(PayrollRun $run, Employee $employee, array $attrs = []): Payslip
    {
        return Payslip::create(array_merge([
            'payroll_run_id' => $run->id,
            'employee_id'    => $employee->id,
            'hours_logged'   => 40.0,
            'hours_extra'    => 0.0,
            'gross_pay'      => 600.00,
            'paye'           => 20.00,
            'prsi_employee'  => 24.00,
            'prsi_employer'  => 66.90,
            'usc'            => 10.00,
            'net_pay'        => 546.00,
        ], $attrs));
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'period_start' => '2026-06-01',
            'period_end'   => '2026-06-07',
            'pay_date'     => '2026-06-10',
        ], $overrides);
    }

    // ── store ─────────────────────────────────────────────────────────────────

    public function test_store_creates_payroll_run_with_draft_status(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload())
            ->assertStatus(201)
            ->assertJsonPath('period_start', '2026-06-01')
            ->assertJsonPath('period_end', '2026-06-07')
            ->assertJsonPath('pay_date', '2026-06-10');

        // Verify the run was persisted with draft status (DB default)
        $this->assertDatabaseHas('payroll_runs', [
            'id'           => $response->json('id'),
            'period_start' => '2026-06-01',
            'period_end'   => '2026-06-07',
            'pay_date'     => '2026-06-10',
            'status'       => 'draft',
        ]);
    }

    public function test_store_creates_payslips_for_all_active_employees(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload())
            ->assertStatus(201);

        $runId = $response->json('id');

        // Both active employees should have payslips
        $this->assertDatabaseHas('payslips', [
            'payroll_run_id' => $runId,
            'employee_id'    => $this->employeeOne->id,
        ]);
        $this->assertDatabaseHas('payslips', [
            'payroll_run_id' => $runId,
            'employee_id'    => $this->employeeTwo->id,
        ]);

        $this->assertCount(2, $response->json('payslips'));
    }

    public function test_store_does_not_create_payslip_for_inactive_employee(): void
    {
        $inactive = $this->makeEmployee(['name' => 'Inactive Worker', 'is_active' => false]);

        $response = $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload())
            ->assertStatus(201);

        $runId = $response->json('id');

        $this->assertDatabaseMissing('payslips', [
            'payroll_run_id' => $runId,
            'employee_id'    => $inactive->id,
        ]);

        // Only the 2 active employees from setUp get payslips
        $this->assertCount(2, $response->json('payslips'));
    }

    public function test_store_requires_period_start(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload(['period_start' => null]))
            ->assertStatus(422)
            ->assertJsonPath('errors.period_start.0', fn($v) => str_contains($v, 'required'));
    }

    public function test_store_requires_period_end(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload(['period_end' => null]))
            ->assertStatus(422)
            ->assertJsonPath('errors.period_end.0', fn($v) => str_contains($v, 'required'));
    }

    public function test_store_requires_pay_date(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload(['pay_date' => null]))
            ->assertStatus(422)
            ->assertJsonPath('errors.pay_date.0', fn($v) => str_contains($v, 'required'));
    }

    public function test_store_rejects_period_end_before_period_start(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/payroll', $this->validPayload([
                'period_start' => '2026-06-07',
                'period_end'   => '2026-06-01',
            ]))
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['period_end']]);
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function test_index_returns_all_payroll_runs(): void
    {
        $this->makeRun(['period_start' => '2026-05-01', 'period_end' => '2026-05-07', 'pay_date' => '2026-05-10']);
        $this->makeRun(['period_start' => '2026-06-01', 'period_end' => '2026-06-07', 'pay_date' => '2026-06-10']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/payroll')
            ->assertOk();

        $this->assertCount(2, $response->json());
    }

    // ── show ──────────────────────────────────────────────────────────────────

    public function test_show_returns_run_with_payslips(): void
    {
        $run = $this->makeRun();
        $this->makePayslip($run, $this->employeeOne);
        $this->makePayslip($run, $this->employeeTwo);

        $this->actingAs($this->admin)
            ->getJson("/api/payroll/{$run->id}")
            ->assertOk()
            ->assertJsonPath('id', $run->id)
            ->assertJsonPath('status', 'draft')
            ->assertJsonCount(2, 'payslips');
    }

    // ── updatePayslip ─────────────────────────────────────────────────────────

    public function test_update_payslip_changes_hours_extra_and_recalculates(): void
    {
        $run     = $this->makeRun();
        $payslip = $this->makePayslip($run, $this->employeeOne);

        $this->actingAs($this->admin)
            ->patchJson("/api/payroll/{$run->id}/payslips/{$payslip->id}", [
                'hours_extra'       => 5.0,
                'extra_description' => 'Bank holiday cover',
            ])
            ->assertOk()
            ->assertJsonPath('extra_description', 'Bank holiday cover')
            ->assertJson(['hours_extra' => 5.0]);

        // Gross should reflect hours_logged (40) + hours_extra (5) × pay_rate (15)
        $this->assertDatabaseHas('payslips', [
            'id'          => $payslip->id,
            'hours_extra' => 5.0,
            'gross_pay'   => 40.0 * 15.00 + 5.0 * 15.00, // 675.00
        ]);
    }

    public function test_update_payslip_on_finalised_run_returns_422(): void
    {
        $run     = $this->makeRun(['status' => 'finalised']);
        $payslip = $this->makePayslip($run, $this->employeeOne);

        $this->actingAs($this->admin)
            ->patchJson("/api/payroll/{$run->id}/payslips/{$payslip->id}", [
                'hours_extra' => 3.0,
            ])
            ->assertStatus(422);
    }

    // ── finalise ──────────────────────────────────────────────────────────────

    public function test_finalise_sets_status_to_finalised(): void
    {
        $run = $this->makeRun();

        $this->actingAs($this->admin)
            ->postJson("/api/payroll/{$run->id}/finalise")
            ->assertOk()
            ->assertJsonPath('status', 'finalised');

        $this->assertDatabaseHas('payroll_runs', [
            'id'     => $run->id,
            'status' => 'finalised',
        ]);
    }

    public function test_finalise_already_finalised_run_returns_422(): void
    {
        $run = $this->makeRun(['status' => 'finalised']);

        $this->actingAs($this->admin)
            ->postJson("/api/payroll/{$run->id}/finalise")
            ->assertStatus(422);
    }

    // ── destroy ───────────────────────────────────────────────────────────────

    public function test_destroy_deletes_draft_run_and_its_payslips(): void
    {
        $run     = $this->makeRun();
        $payslip = $this->makePayslip($run, $this->employeeOne);

        $this->actingAs($this->admin)
            ->deleteJson("/api/payroll/{$run->id}")
            ->assertOk();

        $this->assertDatabaseMissing('payroll_runs', ['id' => $run->id]);
        $this->assertDatabaseMissing('payslips', ['id' => $payslip->id]);
    }

    public function test_destroy_finalised_run_returns_422(): void
    {
        $run = $this->makeRun(['status' => 'finalised']);

        $this->actingAs($this->admin)
            ->deleteJson("/api/payroll/{$run->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('payroll_runs', ['id' => $run->id]);
    }

    // ── Authorisation ─────────────────────────────────────────────────────────

    public function test_field_role_cannot_access_payroll_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/payroll')
            ->assertStatus(403);
    }

    public function test_field_role_cannot_create_payroll_run(): void
    {
        $this->actingAs($this->field)
            ->postJson('/api/payroll', $this->validPayload())
            ->assertStatus(403);
    }

    public function test_field_role_cannot_show_payroll_run(): void
    {
        $run = $this->makeRun();

        $this->actingAs($this->field)
            ->getJson("/api/payroll/{$run->id}")
            ->assertStatus(403);
    }

    public function test_field_role_cannot_finalise_payroll_run(): void
    {
        $run = $this->makeRun();

        $this->actingAs($this->field)
            ->postJson("/api/payroll/{$run->id}/finalise")
            ->assertStatus(403);
    }

    public function test_field_role_cannot_delete_payroll_run(): void
    {
        $run = $this->makeRun();

        $this->actingAs($this->field)
            ->deleteJson("/api/payroll/{$run->id}")
            ->assertStatus(403);
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/payroll')
            ->assertStatus(401);
    }

    public function test_unauthenticated_store_returns_401(): void
    {
        $this->postJson('/api/payroll', $this->validPayload())
            ->assertStatus(401);
    }
}
