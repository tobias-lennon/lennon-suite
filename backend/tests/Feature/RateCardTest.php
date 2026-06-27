<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\RateCard;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RateCardTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $field;
    private RateCard $rateCard;

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

        $this->rateCard = RateCard::create([
            'name'                    => 'Standard 2026',
            'base_rate'               => 26.43,
            'power_tool_uplift'       => 8.81,
            'waste_uplift'            => 13.22,
            'maintenance_rate'        => 41.85,
            'callout_fee'             => 70.48,
            'callout_threshold_hours' => 4.00,
            'is_active'               => true,
        ]);
    }

    // ── index ─────────────────────────────────────────────────────────────────

    public function test_index_returns_active_rate_cards(): void
    {
        // Create an inactive card — it should not appear
        RateCard::create([
            'name'             => 'Archived 2024',
            'base_rate'        => 20.00,
            'maintenance_rate' => 30.00,
            'is_active'        => false,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/rate-cards')
            ->assertOk();

        $names = collect($response->json())->pluck('name');
        $this->assertTrue($names->contains('Standard 2026'));
        $this->assertFalse($names->contains('Archived 2024'));
    }

    public function test_index_returns_only_active_rate_cards(): void
    {
        RateCard::create([
            'name'             => 'Inactive Card',
            'base_rate'        => 15.00,
            'maintenance_rate' => 25.00,
            'is_active'        => false,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/rate-cards')
            ->assertOk();

        foreach ($response->json() as $card) {
            $this->assertTrue($card['is_active']);
        }
    }

    // ── update ────────────────────────────────────────────────────────────────

    public function test_update_changes_name_and_base_rate(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'name'      => 'Premium 2026',
                'base_rate' => 30.00,
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Premium 2026')
            ->assertJson(['base_rate' => 30.00]);

        $this->assertDatabaseHas('rate_cards', [
            'id'        => $this->rateCard->id,
            'name'      => 'Premium 2026',
            'base_rate' => 30.00,
        ]);
    }

    public function test_update_changes_power_tool_uplift(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'power_tool_uplift' => 12.50,
            ])
            ->assertOk()
            ->assertJsonPath('power_tool_uplift', 12.50);

        $this->assertDatabaseHas('rate_cards', [
            'id'                => $this->rateCard->id,
            'power_tool_uplift' => 12.50,
        ]);
    }

    public function test_update_changes_maintenance_rate(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'maintenance_rate' => 50.00,
            ])
            ->assertOk()
            ->assertJson(['maintenance_rate' => 50.00]);

        $this->assertDatabaseHas('rate_cards', [
            'id'               => $this->rateCard->id,
            'maintenance_rate' => 50.00,
        ]);
    }

    public function test_update_rejects_negative_base_rate(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'base_rate' => -5.00,
            ])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['base_rate']]);
    }

    public function test_update_rejects_negative_power_tool_uplift(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'power_tool_uplift' => -1.00,
            ])
            ->assertStatus(422)
            ->assertJsonStructure(['errors' => ['power_tool_uplift']]);
    }

    public function test_update_allows_zero_base_rate(): void
    {
        $this->actingAs($this->admin)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'base_rate' => 0,
            ])
            ->assertOk()
            ->assertJson(['base_rate' => 0]);
    }

    // ── Authorisation ─────────────────────────────────────────────────────────

    public function test_field_role_can_access_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/rate-cards')
            ->assertOk();
    }

    public function test_field_role_cannot_update_rate_card(): void
    {
        $this->actingAs($this->field)
            ->patchJson("/api/rate-cards/{$this->rateCard->id}", [
                'base_rate' => 99.99,
            ])
            ->assertStatus(403);
    }

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/rate-cards')
            ->assertStatus(401);
    }

    public function test_unauthenticated_update_returns_401(): void
    {
        $this->patchJson("/api/rate-cards/{$this->rateCard->id}", [
            'base_rate' => 30.00,
        ])
            ->assertStatus(401);
    }
}
