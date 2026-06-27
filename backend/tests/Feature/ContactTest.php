<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\CompanySetting;
use App\Models\Contact;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContactTest extends TestCase
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

    private function makeContact(array $attrs = []): Contact
    {
        return Contact::create(array_merge([
            'type'      => 'tradesman',
            'name'      => 'Test Contact',
            'is_active' => true,
        ], $attrs));
    }

    // ─── index ────────────────────────────────────────────────────────────────

    public function test_index_returns_paginated_contacts(): void
    {
        $this->makeContact(['name' => 'Alice']);
        $this->makeContact(['name' => 'Bob']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/contacts')
            ->assertOk();

        $this->assertCount(2, $response->json('data'));
    }

    public function test_index_type_filter(): void
    {
        $this->makeContact(['name' => 'Alice', 'type' => 'tradesman']);
        $this->makeContact(['name' => 'Acme',  'type' => 'supplier_company']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/contacts?type=tradesman')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    public function test_index_search_by_name(): void
    {
        $this->makeContact(['name' => 'Alice Murphy']);
        $this->makeContact(['name' => 'Bob Jones']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/contacts?search=alice')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice Murphy', $data[0]['name']);
    }

    public function test_index_search_by_specialty(): void
    {
        $this->makeContact(['name' => 'Alice', 'specialty' => 'Plumbing']);
        $this->makeContact(['name' => 'Bob',   'specialty' => 'Electrical']);

        $response = $this->actingAs($this->admin)
            ->getJson('/api/contacts?search=plumb')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('Alice', $data[0]['name']);
    }

    // ─── store ────────────────────────────────────────────────────────────────

    public function test_store_creates_contact_and_returns_201(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/contacts', [
                'type' => 'tradesman',
                'name' => 'John Doe',
            ])
            ->assertStatus(201)
            ->assertJsonPath('name', 'John Doe')
            ->assertJsonPath('type', 'tradesman');

        $this->assertDatabaseHas('contacts', ['name' => 'John Doe', 'type' => 'tradesman']);
    }

    public function test_store_type_required_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/contacts', ['name' => 'John Doe'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('type');
    }

    public function test_store_type_invalid_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/contacts', [
                'type' => 'employee',
                'name' => 'John Doe',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('type');
    }

    public function test_store_name_required_returns_422(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/contacts', ['type' => 'tradesman'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_store_accepts_all_valid_types(): void
    {
        $validTypes = ['supplier_company', 'supplier_individual', 'tradesman', 'other'];

        foreach ($validTypes as $index => $type) {
            $this->actingAs($this->admin)
                ->postJson('/api/contacts', [
                    'type' => $type,
                    'name' => "Contact {$index}",
                ])
                ->assertStatus(201);
        }
    }

    // ─── show ─────────────────────────────────────────────────────────────────

    public function test_show_returns_contact(): void
    {
        $contact = $this->makeContact(['name' => 'Alice', 'specialty' => 'Plumbing']);

        $this->actingAs($this->admin)
            ->getJson("/api/contacts/{$contact->id}")
            ->assertOk()
            ->assertJsonPath('name',      'Alice')
            ->assertJsonPath('specialty', 'Plumbing');
    }

    // ─── update ───────────────────────────────────────────────────────────────

    public function test_update_changes_contact_fields(): void
    {
        $contact = $this->makeContact(['name' => 'Old Name', 'specialty' => 'Plumbing']);

        $this->actingAs($this->admin)
            ->patchJson("/api/contacts/{$contact->id}", [
                'name'      => 'New Name',
                'specialty' => 'Electrical',
            ])
            ->assertOk()
            ->assertJsonPath('name',      'New Name')
            ->assertJsonPath('specialty', 'Electrical');

        $this->assertDatabaseHas('contacts', [
            'id'        => $contact->id,
            'name'      => 'New Name',
            'specialty' => 'Electrical',
        ]);
    }

    // ─── destroy ──────────────────────────────────────────────────────────────

    public function test_destroy_deletes_contact(): void
    {
        $contact = $this->makeContact(['name' => 'Alice']);

        $this->actingAs($this->admin)
            ->deleteJson("/api/contacts/{$contact->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Contact deleted');

        $this->assertDatabaseMissing('contacts', ['id' => $contact->id]);
    }

    // ─── field role access ────────────────────────────────────────────────────

    public function test_field_can_access_index(): void
    {
        $this->actingAs($this->field)
            ->getJson('/api/contacts')
            ->assertOk();
    }

    public function test_field_can_access_show(): void
    {
        $contact = $this->makeContact();

        $this->actingAs($this->field)
            ->getJson("/api/contacts/{$contact->id}")
            ->assertOk();
    }

    public function test_field_cannot_store_contact(): void
    {
        $this->actingAs($this->field)
            ->postJson('/api/contacts', ['type' => 'tradesman', 'name' => 'Alice'])
            ->assertStatus(403);
    }

    public function test_field_cannot_update_contact(): void
    {
        $contact = $this->makeContact();

        $this->actingAs($this->field)
            ->patchJson("/api/contacts/{$contact->id}", ['name' => 'Changed'])
            ->assertStatus(403);
    }

    public function test_field_cannot_destroy_contact(): void
    {
        $contact = $this->makeContact();

        $this->actingAs($this->field)
            ->deleteJson("/api/contacts/{$contact->id}")
            ->assertStatus(403);
    }

    // ─── unauthenticated ──────────────────────────────────────────────────────

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/contacts')->assertStatus(401);
    }

    public function test_unauthenticated_store_returns_401(): void
    {
        $this->postJson('/api/contacts', ['type' => 'tradesman', 'name' => 'Alice'])
            ->assertStatus(401);
    }
}
