<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\User;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsTest extends TestCase
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
            'company_name'            => 'Lennon Landscaping',
            'vat_rate'                => 13.5,
            'invoice_due_days'        => 30,
            'invoice_prefix'          => 'LL',
            'loyalty_threshold_hours' => 60,
            'loyalty_credit_ex_vat'   => 251.10,
            'target_billable_days'    => 160,
        ]);

        // Prevent real HTTP geocoding calls in all settings tests
        $this->mock(GeocodingService::class, function ($mock) {
            $mock->shouldReceive('geocodeEircode')->andReturn(null);
        });
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_company_settings(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/settings')
            ->assertOk();
    }

    public function test_show_returns_all_expected_fields(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/settings')
            ->assertOk()
            ->assertJsonStructure([
                'company_name',
                'vat_rate',
                'invoice_due_days',
                'loyalty_threshold_hours',
                'loyalty_credit_ex_vat',
            ]);
    }

    public function test_show_returns_correct_default_values(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('company_name', 'Lennon Landscaping')
            ->assertJsonPath('vat_rate', 13.5)
            ->assertJsonPath('invoice_due_days', 30)
            ->assertJsonPath('loyalty_threshold_hours', 60)
            ->assertJsonPath('loyalty_credit_ex_vat', 251.10);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_company_name(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['company_name' => 'New Company Name'])
            ->assertOk()
            ->assertJsonPath('company_name', 'New Company Name');

        $this->assertDatabaseHas('company_settings', ['company_name' => 'New Company Name']);
    }

    public function test_update_returns_updated_settings(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['invoice_prefix' => 'NN'])
            ->assertOk()
            ->assertJsonPath('invoice_prefix', 'NN');
    }

    public function test_update_changes_vat_rate(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['vat_rate' => 23.0])
            ->assertOk()
            ->assertJsonPath('vat_rate', 23);
    }

    public function test_update_rejects_vat_rate_above_100(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['vat_rate' => 101])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['vat_rate']);
    }

    public function test_update_rejects_vat_rate_below_0(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['vat_rate' => -1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['vat_rate']);
    }

    public function test_update_rejects_loyalty_threshold_hours_below_1(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['loyalty_threshold_hours' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['loyalty_threshold_hours']);
    }

    public function test_update_changes_loyalty_threshold_hours(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['loyalty_threshold_hours' => 80])
            ->assertOk()
            ->assertJsonPath('loyalty_threshold_hours', 80);
    }

    public function test_update_rejects_invoice_due_days_below_1(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['invoice_due_days' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['invoice_due_days']);
    }

    public function test_update_changes_invoice_due_days(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['invoice_due_days' => 14])
            ->assertOk()
            ->assertJsonPath('invoice_due_days', 14);
    }

    public function test_update_changes_invoice_prefix(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['invoice_prefix' => 'INV'])
            ->assertOk()
            ->assertJsonPath('invoice_prefix', 'INV');
    }

    public function test_update_changes_loyalty_credit_ex_vat(): void
    {
        $this->actingAs($this->admin)
            ->patchJson('/api/settings', ['loyalty_credit_ex_vat' => 300.00])
            ->assertOk()
            ->assertJsonPath('loyalty_credit_ex_vat', 300);
    }

    // ─── role access ──────────────────────────────────────────────────────────

    public function test_field_role_can_show_settings(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/settings')
            ->assertOk();
    }

    public function test_field_role_cannot_update_settings(): void
    {
        $this->actingAs($this->field)
            ->patchJson('/api/settings', ['company_name' => 'Hacked'])
            ->assertStatus(403);

        $this->assertDatabaseMissing('company_settings', ['company_name' => 'Hacked']);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/settings')->assertStatus(401);
    }

    public function test_unauthenticated_update_returns_401(): void
    {
        $this->patchJson('/api/settings', ['company_name' => 'Anon'])
            ->assertStatus(401);
    }
}
