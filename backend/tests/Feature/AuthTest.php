<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
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

    // ─── login ────────────────────────────────────────────────────────────────

    public function test_login_with_valid_credentials_returns_token_and_user(): void
    {
        $user = User::factory()->create([
            'email'    => 'jane@example.com',
            'password' => Hash::make('secret123'),
            'role'     => UserRole::ADMIN,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'jane@example.com',
            'password' => 'secret123',
        ])
            ->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email', 'role', 'avatar'],
            ])
            ->assertJsonPath('user.id',    $user->id)
            ->assertJsonPath('user.email', 'jane@example.com')
            ->assertJsonPath('user.role',  'admin');
    }

    public function test_login_with_wrong_password_returns_422_with_email_error(): void
    {
        User::factory()->create([
            'email'    => 'jane@example.com',
            'password' => Hash::make('correct'),
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'jane@example.com',
            'password' => 'wrong',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_nonexistent_email_returns_422_with_email_error(): void
    {
        $this->postJson('/api/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'anything',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_missing_email_returns_422(): void
    {
        $this->postJson('/api/auth/login', ['password' => 'secret'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_with_missing_password_returns_422(): void
    {
        $this->postJson('/api/auth/login', ['email' => 'jane@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    // ─── logout ───────────────────────────────────────────────────────────────

    public function test_logout_returns_200_with_message(): void
    {
        // actingAs() creates a TransientToken with no delete() method — use a real Sanctum token
        $token = $this->admin->createToken('test-token')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out');
    }

    public function test_logout_without_token_returns_401(): void
    {
        $this->postJson('/api/auth/logout')
            ->assertStatus(401);
    }

    // ─── me ───────────────────────────────────────────────────────────────────

    public function test_me_returns_current_user_fields(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonStructure(['id', 'name', 'email', 'role', 'avatar'])
            ->assertJsonPath('id',    $this->admin->id)
            ->assertJsonPath('email', $this->admin->email);
    }

    public function test_me_without_token_returns_401(): void
    {
        $this->getJson('/api/auth/me')
            ->assertStatus(401);
    }

    // ─── role in response ─────────────────────────────────────────────────────

    public function test_admin_user_has_role_admin_in_login_response(): void
    {
        $admin = User::factory()->create([
            'email'    => 'admin@example.com',
            'password' => Hash::make('pass'),
            'role'     => UserRole::ADMIN,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'admin@example.com',
            'password' => 'pass',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin');
    }

    public function test_field_user_has_role_field_in_login_response(): void
    {
        $field = User::factory()->create([
            'email'    => 'field@example.com',
            'password' => Hash::make('pass'),
            'role'     => UserRole::FIELD,
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'field@example.com',
            'password' => 'pass',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'field');
    }
}
