<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeTest extends TestCase
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

    private function makeEmployee(array $attrs = []): Employee
    {
        return Employee::create(array_merge([
            'name'      => 'Test Worker',
            'pay_rate'  => 15.00,
            'is_active' => true,
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_all_employees(): void
    {
        $this->makeEmployee(['name' => 'Alice']);
        $this->makeEmployee(['name' => 'Bob']);

        $this->actingAs($this->admin)
            ->getJson('/api/employees')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_index_returns_employees_ordered_alphabetically(): void
    {
        $this->makeEmployee(['name' => 'Zara']);
        $this->makeEmployee(['name' => 'Aaron']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/employees')
            ->assertOk();

        $names = collect($response->json())->pluck('name')->values()->toArray();
        $this->assertSame(['Aaron', 'Zara'], $names);
    }

    // ─── store — no linked user ────────────────────────────────────────────────

    public function test_store_creates_employee_without_user_when_no_email(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', [
                'name'     => 'Charlie Brown',
                'pay_rate' => 14.50,
            ])
            ->assertStatus(201)
            ->assertJsonPath('name', 'Charlie Brown')
            ->assertJsonPath('pay_rate', 14.50)
            ->assertJsonPath('user', null);

        $this->assertDatabaseHas('employees', [
            'name'     => 'Charlie Brown',
            'pay_rate' => 14.50,
        ]);
    }

    // ─── store — with linked user ──────────────────────────────────────────────

    public function test_store_creates_linked_user_when_email_provided(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', [
                'name'     => 'Dana White',
                'pay_rate' => 16.00,
                'email'    => 'dana@example.com',
                'password' => 'Secret1234',
            ])
            ->assertStatus(201)
            ->assertJsonPath('name', 'Dana White');

        $this->assertDatabaseHas('users', ['email' => 'dana@example.com']);

        $user = User::where('email', 'dana@example.com')->first();
        $this->assertNotNull($user);

        $this->assertDatabaseHas('employees', [
            'name'    => 'Dana White',
            'user_id' => $user->id,
        ]);
    }

    public function test_store_linked_user_has_field_role(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', [
                'name'     => 'Eve Fields',
                'pay_rate' => 15.00,
                'email'    => 'eve@example.com',
                'password' => 'Secret1234',
            ])
            ->assertStatus(201);

        $user = User::where('email', 'eve@example.com')->first();
        $this->assertSame('field', $user->role instanceof UserRole ? $user->role->value : $user->role);
    }

    // ─── store — validation ────────────────────────────────────────────────────

    public function test_store_requires_pay_rate(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', ['name' => 'No Rate'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['pay_rate']);
    }

    public function test_store_requires_name(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/employees', ['pay_rate' => 15.00])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_store_email_must_be_unique_in_users_table(): void
    {
        // Pre-existing user occupies this email
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs($this->admin)
            ->postJson('/api/employees', [
                'name'     => 'Duplicate Email',
                'pay_rate' => 15.00,
                'email'    => 'taken@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_employee_name_and_pay_rate(): void
    {
        $employee = $this->makeEmployee(['name' => 'Old Name', 'pay_rate' => 12.00]);

        $this->actingAs($this->admin)
            ->patchJson("/api/employees/{$employee->id}", [
                'name'     => 'New Name',
                'pay_rate' => 18.00,
            ])
            ->assertOk()
            ->assertJsonPath('name', 'New Name')
            ->assertJsonPath('pay_rate', 18);

        $this->assertDatabaseHas('employees', [
            'id'       => $employee->id,
            'name'     => 'New Name',
            'pay_rate' => 18.00,
        ]);
    }

    public function test_update_also_updates_linked_user_name(): void
    {
        $user = User::factory()->create(['name' => 'Old User Name', 'role' => UserRole::FIELD]);
        $employee = $this->makeEmployee(['name' => 'Old Name', 'user_id' => $user->id]);

        $this->actingAs($this->admin)
            ->patchJson("/api/employees/{$employee->id}", ['name' => 'Updated Name'])
            ->assertOk();

        $this->assertDatabaseHas('users', [
            'id'   => $user->id,
            'name' => 'Updated Name',
        ]);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_sets_is_active_false_not_hard_delete(): void
    {
        $employee = $this->makeEmployee(['is_active' => true]);

        $this->actingAs($this->admin)
            ->deleteJson("/api/employees/{$employee->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Employee deactivated.');

        // Row still exists in database
        $this->assertDatabaseHas('employees', [
            'id'        => $employee->id,
            'is_active' => false,
        ]);
    }

    // ─── Role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_view_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/employees')
            ->assertOk();
    }

    public function test_field_role_cannot_store_employee(): void
    {
        $this->actingAs($this->field)
            ->postJson('/api/employees', [
                'name'     => 'Unauthorised',
                'pay_rate' => 15.00,
            ])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_update_employee(): void
    {
        $employee = $this->makeEmployee();

        $this->actingAs($this->field)
            ->patchJson("/api/employees/{$employee->id}", ['name' => 'Hack'])
            ->assertStatus(403);
    }

    public function test_field_role_cannot_destroy_employee(): void
    {
        $employee = $this->makeEmployee();

        $this->actingAs($this->field)
            ->deleteJson("/api/employees/{$employee->id}")
            ->assertStatus(403);
    }

    // ─── Unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_index_employees(): void
    {
        $this->getJson('/api/employees')
            ->assertStatus(401);
    }

    public function test_unauthenticated_cannot_store_employee(): void
    {
        $this->postJson('/api/employees', ['name' => 'Ghost', 'pay_rate' => 10.00])
            ->assertStatus(401);
    }
}
