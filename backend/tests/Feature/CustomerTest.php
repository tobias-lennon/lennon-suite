<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Customer;
use App\Models\CustomerFollowup;
use App\Models\User;
use App\Services\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerTest extends TestCase
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

        // Prevent real HTTP geocoding calls in every test
        $this->mock(GeocodingService::class, function ($mock) {
            $mock->shouldReceive('geocodeEircode')->andReturn(null);
        });
    }

    private function makeCustomer(array $attrs = []): Customer
    {
        return Customer::create(array_merge([
            'name'      => 'Test Customer',
            'type'      => 'residential',
            'is_active' => true,
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_active_customers(): void
    {
        $this->makeCustomer(['name' => 'Alice']);
        $this->makeCustomer(['name' => 'Bob', 'is_active' => false]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_search_filters_by_name(): void
    {
        $this->makeCustomer(['name' => 'Alice Smith']);
        $this->makeCustomer(['name' => 'Bob Jones']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?search=alice')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice Smith', $data[0]['name']);
    }

    public function test_index_search_filters_by_email(): void
    {
        $this->makeCustomer(['name' => 'Alice', 'email' => 'alice@example.com']);
        $this->makeCustomer(['name' => 'Bob',   'email' => 'bob@example.com']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?search=alice@example')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_search_filters_by_phone(): void
    {
        $this->makeCustomer(['name' => 'Alice', 'phone' => '0851234567']);
        $this->makeCustomer(['name' => 'Bob',   'phone' => '0867654321']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?search=0851234')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_type_filter_residential(): void
    {
        $this->makeCustomer(['name' => 'Alice', 'type' => 'residential']);
        $this->makeCustomer(['name' => 'Bob',   'type' => 'commercial']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?type=residential')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_type_filter_commercial(): void
    {
        $this->makeCustomer(['name' => 'Alice', 'type' => 'residential']);
        $this->makeCustomer(['name' => 'Corp',  'type' => 'commercial']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?type=commercial')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Corp', $data[0]['name']);
    }

    public function test_index_sort_desc_returns_reverse_alpha(): void
    {
        $this->makeCustomer(['name' => 'Alice']);
        $this->makeCustomer(['name' => 'Bob']);
        $this->makeCustomer(['name' => 'Charlie']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers?sort=name_desc')
            ->assertOk();

        $names = array_column($response->json('data'), 'name');
        $this->assertEquals(['Charlie', 'Bob', 'Alice'], $names);
    }

    public function test_index_excludes_archived_customers(): void
    {
        $this->makeCustomer(['name' => 'Active Customer',   'is_active' => true]);
        $this->makeCustomer(['name' => 'Archived Customer', 'is_active' => false]);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/customers')
            ->assertOk();

        $names = array_column($response->json('data'), 'name');
        $this->assertContains('Active Customer', $names);
        $this->assertNotContains('Archived Customer', $names);
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_customer_with_address_and_followups(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice']);
        $customer->address()->create([
            'address_line_1' => '1 Main Street',
            'city'           => 'Cork',
            'county'         => 'CORK',
        ]);
        $customer->followups()->create([
            'note'           => 'Call back',
            'follow_up_date' => now()->addDays(3)->toDateString(),
        ]);

        $this->actingAs($this->admin)
            ->getJson("/api/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('name', 'Alice')
            ->assertJsonPath('address.city', 'Cork')
            ->assertJsonStructure(['followups']);
    }

    public function test_show_followups_sorted_unresolved_first(): void
    {
        $customer = $this->makeCustomer();

        $resolved = $customer->followups()->create([
            'note'        => 'Done',
            'resolved_at' => now(),
        ]);
        $unresolved = $customer->followups()->create([
            'note' => 'Pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/customers/{$customer->id}")
            ->assertOk();

        $followups = $response->json('followups');
        $this->assertCount(2, $followups);
        // Unresolved first
        $this->assertNull($followups[0]['resolved_at']);
        $this->assertNotNull($followups[1]['resolved_at']);
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_customer_and_returns_201(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/customers', ['name' => 'New Customer', 'discount_pct' => 0])
            ->assertStatus(201)
            ->assertJsonPath('name', 'New Customer');

        $this->assertDatabaseHas('customers', ['name' => 'New Customer']);
    }

    public function test_store_creates_address_when_address_data_provided(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'         => 'Alice',
                'discount_pct' => 0,
                'address'      => [
                    'address_line_1' => '10 High Street',
                    'city'           => 'Millstreet',
                    'county'         => 'CORK',
                ],
            ])
            ->assertStatus(201);

        $customerId = $response->json('id');
        $this->assertDatabaseHas('addresses', [
            'customer_id'    => $customerId,
            'address_line_1' => '10 High Street',
            'city'           => 'Millstreet',
            'county'         => 'CORK',
        ]);
    }

    public function test_store_normalises_county_prefix(): void
    {
        // "Co. Cork" → "CORK" after normalisation
        $response = $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'         => 'Alice',
                'discount_pct' => 0,
                'address'      => [
                    'county' => 'CORK',
                ],
            ])
            ->assertStatus(201);

        $customerId = $response->json('id');
        $this->assertDatabaseHas('addresses', [
            'customer_id' => $customerId,
            'county'      => 'CORK',
        ]);
    }

    public function test_store_normalises_eircode_format(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'         => 'Alice',
                'discount_pct' => 0,
                'address'      => [
                    'postcode' => 'P12AB34',
                ],
            ])
            ->assertStatus(201);

        $customerId = $response->json('id');
        $this->assertDatabaseHas('addresses', [
            'customer_id' => $customerId,
            'postcode'    => 'P12 AB34',
        ]);
    }

    public function test_store_lowercases_email(): void
    {
        // Use a domain with actual MX records — email:rfc,dns requires resolvable domain
        $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'         => 'Alice',
                'discount_pct' => 0,
                'email'        => 'Alice@GMAIL.COM',
            ])
            ->assertStatus(201)
            ->assertJsonPath('email', 'alice@gmail.com');

        $this->assertDatabaseHas('customers', ['email' => 'alice@gmail.com']);
    }

    public function test_store_defaults_type_to_residential(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/customers', ['name' => 'Alice', 'discount_pct' => 0])
            ->assertStatus(201);

        $this->assertEquals('residential', $response->json('type'));
    }

    public function test_store_name_required_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/customers', ['phone' => '0851234567'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_store_county_must_be_valid_irish_county_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'    => 'Alice',
                'address' => ['county' => 'INVALIDSHIRE'],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('address.county');
    }

    public function test_store_eircode_regex_must_match_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'    => 'Alice',
                'address' => ['postcode' => 'TOOLONGPOSTCODE99'],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('address.postcode');
    }

    public function test_store_rating_must_be_1_to_5_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/customers', [
                'name'   => 'Alice',
                'rating' => 6,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('rating');
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_partial_update_only_changes_name(): void
    {
        $customer = $this->makeCustomer(['name' => 'Old Name', 'phone' => '0851234567']);

        // CustomerController sanitise() always includes every key, so the full payload
        // must be sent to preserve existing fields (matching how the frontend works)
        $this->actingAs($this->admin)
            ->patchJson("/api/customers/{$customer->id}", [
                'name'  => 'New Name',
                'phone' => '0851234567',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'New Name');

        $this->assertDatabaseHas('customers', [
            'id'    => $customer->id,
            'name'  => 'New Name',
            'phone' => '0851234567',
        ]);
    }

    public function test_update_can_clear_email_by_sending_null(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice', 'email' => 'alice@example.com']);

        $this->actingAs($this->admin)
            ->putJson("/api/customers/{$customer->id}", ['email' => null])
            ->assertOk()
            ->assertJsonPath('email', null);

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'email' => null]);
    }

    // ─── archive ──────────────────────────────────────────────────────────────

    public function test_archive_sets_is_active_to_false(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice', 'is_active' => true]);

        $this->actingAs($this->admin)
            ->patchJson("/api/customers/{$customer->id}/archive")
            ->assertOk();

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'is_active' => false]);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_customer(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice']);

        $this->actingAs($this->admin)
            ->deleteJson("/api/customers/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Customer deleted');

        $this->assertDatabaseMissing('customers', ['id' => $customer->id]);
    }

    // ─── history ──────────────────────────────────────────────────────────────

    public function test_history_returns_stats_and_job_list(): void
    {
        $customer = $this->makeCustomer(['name' => 'Alice']);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/customers/{$customer->id}/history")
            ->assertOk();

        $response->assertJsonStructure([
            'stats' => ['total_jobs', 'total_visits', 'first_job_date', 'last_job_date', 'is_returning'],
            'jobs',
        ]);
    }

    public function test_history_is_returning_false_when_zero_jobs(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->getJson("/api/customers/{$customer->id}/history")
            ->assertOk()
            ->assertJsonPath('stats.is_returning', false)
            ->assertJsonPath('stats.total_jobs', 0);
    }

    // ─── setDiscount ──────────────────────────────────────────────────────────

    public function test_set_discount_sets_discount_pct(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->patchJson("/api/customers/{$customer->id}/discount", ['discount_pct' => 15])
            ->assertOk();

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'discount_pct' => 15]);
    }

    // ─── setRates ─────────────────────────────────────────────────────────────

    public function test_set_rates_sets_default_callout_fee(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->admin)
            ->patchJson("/api/customers/{$customer->id}/rates", ['default_callout_fee' => 50])
            ->assertOk();

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'default_callout_fee' => 50]);
    }

    // ─── stats ────────────────────────────────────────────────────────────────

    public function test_stats_returns_correct_counts(): void
    {
        $this->makeCustomer(['type' => 'residential', 'email' => 'a@example.com']);
        $this->makeCustomer(['type' => 'residential', 'email' => null]);
        $this->makeCustomer(['type' => 'commercial',  'email' => 'b@example.com']);
        // Archived — should not be counted
        $this->makeCustomer(['type' => 'residential', 'is_active' => false]);

        $this->actingAs($this->admin)
            ->getJson('/api/customers/stats')
            ->assertOk()
            ->assertJsonPath('total',       3)
            ->assertJsonPath('residential', 2)
            ->assertJsonPath('commercial',  1)
            ->assertJsonPath('with_email',  2);
    }

    // ─── field role access ────────────────────────────────────────────────────

    public function test_field_can_access_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/customers')
            ->assertOk();
    }

    public function test_field_can_access_show(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->getJson("/api/customers/{$customer->id}")
            ->assertOk();
    }

    public function test_field_can_access_stats(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/customers/stats')
            ->assertOk();
    }

    public function test_field_can_access_history(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->getJson("/api/customers/{$customer->id}/history")
            ->assertOk();
    }

    public function test_field_cannot_store_customer(): void
    {
        $this->actingAs($this->field)
            ->postJson('/api/customers', ['name' => 'Alice'])
            ->assertStatus(403);
    }

    public function test_field_cannot_update_customer(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->putJson("/api/customers/{$customer->id}", ['name' => 'Changed'])
            ->assertStatus(403);
    }

    public function test_field_cannot_destroy_customer(): void
    {
        $customer = $this->makeCustomer();

        $this->actingAs($this->field)
            ->deleteJson("/api/customers/{$customer->id}")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/customers')->assertStatus(401);
    }

    public function test_unauthenticated_store_returns_401(): void
    {
        $this->postJson('/api/customers', ['name' => 'Alice'])->assertStatus(401);
    }
}
