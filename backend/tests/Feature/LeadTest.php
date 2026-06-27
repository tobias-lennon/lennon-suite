<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeadTest extends TestCase
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

    private function makeLead(array $attrs = []): Lead
    {
        return Lead::create(array_merge([
            'name'   => 'Test Lead',
            'status' => 'new',
            'source' => 'other',
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_leads(): void
    {
        $this->makeLead(['name' => 'Lead A']);
        $this->makeLead(['name' => 'Lead B']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/leads')
            ->assertOk();

        $this->assertCount(2, $response->json('data'));
    }

    public function test_index_search_filters_by_name(): void
    {
        $this->makeLead(['name' => 'Alice Murphy']);
        $this->makeLead(['name' => 'Bob Jones']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/leads?search=alice')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice Murphy', $data[0]['name']);
    }

    public function test_index_search_filters_by_phone(): void
    {
        $this->makeLead(['name' => 'Alice', 'phone' => '0851234567']);
        $this->makeLead(['name' => 'Bob',   'phone' => '0867654321']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/leads?search=0851234')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_search_filters_by_email(): void
    {
        $this->makeLead(['name' => 'Alice', 'email' => 'alice@example.com']);
        $this->makeLead(['name' => 'Bob',   'email' => 'bob@example.com']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/leads?search=alice@example')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_status_filter(): void
    {
        $this->makeLead(['name' => 'NewLead',      'status' => 'new']);
        $this->makeLead(['name' => 'ContactedLead', 'status' => 'contacted']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/leads?status=new')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('NewLead', $data[0]['name']);
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_lead_and_returns_201(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/leads', [
                'name'   => 'John Doe',
                'phone'  => '0851234567',
                'source' => 'google',
                'status' => 'new',
            ])
            ->assertStatus(201)
            ->assertJsonPath('name', 'John Doe');

        $this->assertDatabaseHas('leads', ['name' => 'John Doe']);
    }

    public function test_store_source_validation_accepts_valid_sources(): void
    {
        foreach (['word_of_mouth', 'google', 'instagram', 'referral', 'other'] as $source) {
            $this->actingAs($this->admin)
                ->postJson('/api/leads', [
                    'name'   => 'Test',
                    'source' => $source,
                ])
                ->assertStatus(201);
        }
    }

    public function test_store_source_invalid_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/leads', [
                'name'   => 'Test',
                'source' => 'tiktok',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('source');
    }

    public function test_store_status_validation_accepts_valid_statuses(): void
    {
        foreach (['new', 'contacted', 'quoted', 'site_visited', 'won', 'lost'] as $status) {
            $this->actingAs($this->admin)
                ->postJson('/api/leads', [
                    'name'   => 'Test',
                    'status' => $status,
                ])
                ->assertStatus(201);
        }
    }

    public function test_store_status_invalid_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/leads', [
                'name'   => 'Test',
                'status' => 'archived',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_store_name_required_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/leads', ['phone' => '0851234567'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_lead_with_converted_customer_null_if_not_converted(): void
    {
        $lead = $this->makeLead(['name' => 'Alice']);

        $this->actingAs($this->admin)
            ->getJson("/api/leads/{$lead->id}")
            ->assertOk()
            ->assertJsonPath('name', 'Alice')
            ->assertJsonPath('converted_customer', null);
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_lead_fields(): void
    {
        $lead = $this->makeLead(['name' => 'Old Name', 'status' => 'new']);

        $this->actingAs($this->admin)
            ->putJson("/api/leads/{$lead->id}", ['name' => 'New Name', 'status' => 'contacted'])
            ->assertOk()
            ->assertJsonPath('name',   'New Name')
            ->assertJsonPath('status', 'contacted');

        $this->assertDatabaseHas('leads', [
            'id'     => $lead->id,
            'name'   => 'New Name',
            'status' => 'contacted',
        ]);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_lead(): void
    {
        $lead = $this->makeLead(['name' => 'Alice']);

        $this->actingAs($this->admin)
            ->deleteJson("/api/leads/{$lead->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Lead deleted');

        $this->assertDatabaseMissing('leads', ['id' => $lead->id]);
    }

    // ─── convert ──────────────────────────────────────────────────────────────

    public function test_convert_creates_customer_from_lead(): void
    {
        $lead = $this->makeLead([
            'name'   => 'Alice Murphy',
            'phone'  => '0851234567',
            'email'  => 'alice@example.com',
            'status' => 'quoted',
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/leads/{$lead->id}/convert")
            ->assertStatus(201)
            ->assertJsonStructure(['customer_id', 'customer']);

        $this->assertDatabaseHas('customers', [
            'name'  => 'Alice Murphy',
            'phone' => '0851234567',
            'email' => 'alice@example.com',
        ]);
    }

    public function test_convert_sets_lead_status_to_won_and_converted_customer_id(): void
    {
        $lead = $this->makeLead(['name' => 'Alice Murphy', 'status' => 'quoted']);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/leads/{$lead->id}/convert")
            ->assertStatus(201);

        $customerId = $response->json('customer_id');

        $this->assertDatabaseHas('leads', [
            'id'                    => $lead->id,
            'status'                => 'won',
            'converted_customer_id' => $customerId,
        ]);
    }

    public function test_convert_on_already_converted_lead_returns_existing_customer(): void
    {
        $lead = $this->makeLead(['name' => 'Alice Murphy', 'status' => 'quoted']);

        // Convert once
        $firstResponse = $this->actingAs($this->admin)
            ->postJson("/api/leads/{$lead->id}/convert")
            ->assertStatus(201);

        $firstCustomerId = $firstResponse->json('customer_id');

        // Attempt second convert — lead now has converted_customer_id set
        $secondResponse = $this->actingAs($this->admin)
            ->postJson("/api/leads/{$lead->id}/convert")
            ->assertOk()
            ->assertJsonPath('customer_id', $firstCustomerId)
            ->assertJsonPath('message', 'Already converted');
    }

    // ─── field role access ────────────────────────────────────────────────────

    public function test_field_can_access_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/leads')
            ->assertOk();
    }

    public function test_field_can_access_show(): void
    {
        $lead = $this->makeLead();

        $this->actingAs($this->field)
            ->getJson("/api/leads/{$lead->id}")
            ->assertOk();
    }

    public function test_field_cannot_store_lead(): void
    {
        $this->actingAs($this->field)
            ->postJson('/api/leads', ['name' => 'Alice'])
            ->assertStatus(403);
    }

    public function test_field_cannot_update_lead(): void
    {
        $lead = $this->makeLead();

        $this->actingAs($this->field)
            ->putJson("/api/leads/{$lead->id}", ['name' => 'Changed'])
            ->assertStatus(403);
    }

    public function test_field_cannot_destroy_lead(): void
    {
        $lead = $this->makeLead();

        $this->actingAs($this->field)
            ->deleteJson("/api/leads/{$lead->id}")
            ->assertStatus(403);
    }

    public function test_field_cannot_convert_lead(): void
    {
        $lead = $this->makeLead();

        $this->actingAs($this->field)
            ->postJson("/api/leads/{$lead->id}/convert")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/leads')->assertStatus(401);
    }

    public function test_unauthenticated_store_returns_401(): void
    {
        $this->postJson('/api/leads', ['name' => 'Alice'])->assertStatus(401);
    }
}
