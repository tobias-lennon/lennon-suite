<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Services\GeocodingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(private GeocodingService $geocoding) {}

    private const COUNTIES = [
        'CARLOW', 'CAVAN', 'CLARE', 'CORK', 'DONEGAL',
        'DUBLIN', 'GALWAY', 'KERRY', 'KILDARE', 'KILKENNY',
        'LAOIS', 'LEITRIM', 'LIMERICK', 'LONGFORD', 'LOUTH',
        'MAYO', 'MEATH', 'MONAGHAN', 'OFFALY', 'ROSCOMMON',
        'SLIGO', 'TIPPERARY', 'WATERFORD', 'WESTMEATH',
        'WEXFORD', 'WICKLOW',
        'ANTRIM', 'ARMAGH', 'DOWN', 'FERMANAGH', 'LONDONDERRY', 'TYRONE',
    ];

    /** Strip tags, trim, and collapse internal whitespace on a string field. */
    private function clean(?string $value): ?string
    {
        if ($value === null) return null;
        $value = strip_tags($value);
        $value = preg_replace('/\s+/', ' ', $value);
        $value = trim($value);
        return $value === '' ? null : $value;
    }

    /** Strip "Co." prefix (any capitalisation) and uppercase — e.g. "Co. Cork" → "CORK". */
    private function normaliseCounty(?string $value): ?string
    {
        if ($value === null) return null;
        $value = strip_tags($value);
        $value = preg_replace('/^co[.\s]\s*/i', '', $value);
        $value = strtoupper(trim($value));
        return $value === '' ? null : $value;
    }

    /** Normalise an Eircode: uppercase, strip non-alphanumeric, insert space after char 3 if 7 chars. */
    private function normaliseEircode(?string $value): ?string
    {
        if ($value === null) return null;
        $clean = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $value));
        if (strlen($clean) === 7) {
            return substr($clean, 0, 3) . ' ' . substr($clean, 3);
        }
        return $clean === '' ? null : $clean;
    }

    /** Pull sanitised customer + address fields from validated data. */
    private function sanitise(array $data): array
    {
        $addr = $data['address'] ?? [];

        return [
            'customer' => [
                'name'                => $this->clean($data['name'] ?? null),
                'type'                => $data['type'] ?? null,
                'phone'               => $this->clean($data['phone'] ?? null),
                'email'               => isset($data['email']) ? strtolower(trim($data['email'])) : null,
                'notes'               => $this->clean($data['notes'] ?? null),
                'rating'              => $data['rating'] ?? null,
                'minutes_from_hq'     => isset($data['minutes_from_hq']) ? (int) $data['minutes_from_hq'] : null,
                'discount_pct'        => $data['discount_pct'] ?? null,
                'default_callout_fee' => $data['default_callout_fee'] ?? null,
            ],
            'address' => [
                'address_line_1' => $this->clean($addr['address_line_1'] ?? null),
                'address_line_2' => $this->clean($addr['address_line_2'] ?? null),
                'city'           => $this->clean($addr['city'] ?? null),
                'county'         => $this->normaliseCounty($addr['county'] ?? null),
                'postcode'       => $this->normaliseEircode($addr['postcode'] ?? null),
            ],
        ];
    }
    public function index(Request $request): JsonResponse
    {
        $query = Customer::with('address')->where('is_active', true);

        if ($request->filled('search')) {
            $term = '%' . $request->search . '%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                  ->orWhere('email', 'like', $term)
                  ->orWhere('phone', 'like', $term)
                  ->orWhereHas('address', fn ($a) => $a->where('city', 'like', $term)
                      ->orWhere('county', 'like', $term)
                      ->orWhere('postcode', 'like', $term));
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('activity')) {
            $cutoff = match($request->activity) {
                '3m'       => now()->subMonths(3),
                '6m'       => now()->subMonths(6),
                '12m'      => now()->subMonths(12),
                'inactive' => now()->subMonths(12),
                default    => null,
            };

            if ($cutoff) {
                if ($request->activity === 'inactive') {
                    $query->whereDoesntHave('fieldJobs', fn($q) => $q->where('created_at', '>=', $cutoff));
                } else {
                    $query->whereHas('fieldJobs', fn($q) => $q->where('created_at', '>=', $cutoff));
                }
            }
        }

        $direction = $request->input('sort') === 'name_desc' ? 'desc' : 'asc';

        if ($request->filled('search')) {
            // Rank exact starts-with matches above mid-string matches, then alpha within each tier
            $query->orderByRaw('CASE WHEN name LIKE ? THEN 0 ELSE 1 END', [$request->search . '%'])
                  ->orderBy('name', $direction);
        } else {
            $query->orderBy('name', $direction);
        }

        $customers = $query->paginate(25);

        return response()->json($customers);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($customer->load('address'));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                    => 'required|string|max:200',
            'type'                    => 'nullable|string|in:residential,commercial',
            'phone'                   => 'nullable|string|max:30',
            'email'                   => 'nullable|email:rfc,dns|max:255',
            'notes'                   => 'nullable|string|max:5000',
            'rating'                  => 'nullable|integer|min:1|max:5',
            'minutes_from_hq'         => 'nullable|integer|min:1|max:600',
            'discount_pct'            => 'nullable|numeric|min:0|max:100',
            'default_callout_fee'     => 'nullable|numeric|min:0',
            'address.address_line_1'  => 'nullable|string|max:255',
            'address.address_line_2'  => 'nullable|string|max:255',
            'address.city'            => 'nullable|string|max:100',
            'address.county'          => ['nullable', 'string', 'in:' . implode(',', self::COUNTIES)],
            'address.postcode'        => ['nullable', 'string', 'max:10', 'regex:/^[A-Za-z0-9 ]{3,8}$/'],
        ]);

        $clean = $this->sanitise($data);

        $customer = Customer::create(array_merge(
            $clean['customer'],
            ['type' => $clean['customer']['type'] ?? 'residential']
        ));

        $addr = array_filter($clean['address'], fn($v) => $v !== null);
        if (!empty($addr)) {
            $customer->address()->create($clean['address']);
        }

        if ($clean['address']['postcode'] ?? null) {
            $coords = $this->geocoding->geocodeEircode($clean['address']['postcode']);
            if ($coords) {
                $customer->update(['latitude' => $coords['latitude'], 'longitude' => $coords['longitude']]);
            }
        }

        return response()->json($customer->load('address'), 201);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'name'                    => 'sometimes|required|string|max:200',
            'type'                    => 'nullable|string|in:residential,commercial',
            'phone'                   => 'nullable|string|max:30',
            'email'                   => 'nullable|email:rfc,dns|max:255',
            'notes'                   => 'nullable|string|max:5000',
            'rating'                  => 'nullable|integer|min:1|max:5',
            'minutes_from_hq'         => 'nullable|integer|min:1|max:600',
            'discount_pct'            => 'nullable|numeric|min:0|max:100',
            'default_callout_fee'     => 'nullable|numeric|min:0',
            'address.address_line_1'  => 'nullable|string|max:255',
            'address.address_line_2'  => 'nullable|string|max:255',
            'address.city'            => 'nullable|string|max:100',
            'address.county'          => ['nullable', 'string', 'in:' . implode(',', self::COUNTIES)],
            'address.postcode'        => ['nullable', 'string', 'max:10', 'regex:/^[A-Za-z0-9 ]{3,8}$/'],
        ]);

        $clean = $this->sanitise($data);

        $customer->update([
            'name'                => $clean['customer']['name']   ?? $customer->name,
            'type'                => array_key_exists('type',                $clean['customer']) ? ($clean['customer']['type']                ?? $customer->type)                : $customer->type,
            'phone'               => array_key_exists('phone',               $clean['customer']) ? ($clean['customer']['phone']               ?? null)                          : $customer->phone,
            'email'               => array_key_exists('email',               $clean['customer']) ? ($clean['customer']['email']               ?? null)                          : $customer->email,
            'notes'               => array_key_exists('notes',               $clean['customer']) ? ($clean['customer']['notes']               ?? null)                          : $customer->notes,
            'rating'              => array_key_exists('rating',              $clean['customer']) ? ($clean['customer']['rating']              ?? null)                          : $customer->rating,
            'minutes_from_hq'     => array_key_exists('minutes_from_hq',     $clean['customer']) ? ($clean['customer']['minutes_from_hq']     ?? null)                          : $customer->minutes_from_hq,
            'discount_pct'        => array_key_exists('discount_pct',        $clean['customer']) ? ($clean['customer']['discount_pct']        ?? 0)                             : $customer->discount_pct,
            'default_callout_fee' => array_key_exists('default_callout_fee', $clean['customer']) ? ($clean['customer']['default_callout_fee'] ?? null)                          : $customer->default_callout_fee,
        ]);

        if (isset($data['address'])) {
            $customer->address()->updateOrCreate(
                ['customer_id' => $customer->id],
                $clean['address']
            );

            if ($clean['address']['postcode'] ?? null) {
                $coords = $this->geocoding->geocodeEircode($clean['address']['postcode']);
                if ($coords) {
                    $customer->update(['latitude' => $coords['latitude'], 'longitude' => $coords['longitude']]);
                }
            }
        }

        return response()->json($customer->load('address'));
    }

    public function archive(Customer $customer): JsonResponse
    {
        $customer->update(['is_active' => false]);

        return response()->json(['message' => 'Customer archived']);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        $customer->delete();

        return response()->json(['message' => 'Customer deleted']);
    }

    public function history(Customer $customer): JsonResponse
    {
        $jobs = $customer->fieldJobs()
            ->with('workLogs.entries')
            ->orderBy('scheduled_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($job) {
                $totalCharged = $job->workLogs
                    ->flatMap(fn($log) => $log->entries)
                    ->sum('amount_charged');

                return [
                    'id'              => $job->id,
                    'title'           => $job->title,
                    'type'            => $job->type,
                    'status'          => $job->status,
                    'scheduled_date'  => $job->scheduled_date?->toDateString(),
                    'work_logs_count' => $job->workLogs->count(),
                    'total_charged'   => round((float) $totalCharged, 2),
                ];
            });

        $scheduledDates = $jobs->pluck('scheduled_date')->filter()->sort()->values();

        return response()->json([
            'stats' => [
                'total_jobs'     => $jobs->count(),
                'total_visits'   => $jobs->sum('work_logs_count'),
                'first_job_date' => $scheduledDates->first(),
                'last_job_date'  => $scheduledDates->last(),
                'is_returning'   => $jobs->count() > 1,
            ],
            'jobs' => $jobs->values(),
        ]);
    }

    public function setDiscount(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'discount_pct' => 'required|numeric|min:0|max:100',
        ]);

        $customer->update(['discount_pct' => $data['discount_pct']]);

        return response()->json($customer->fresh());
    }

    public function setRates(Request $request, Customer $customer): JsonResponse
    {
        $data = $request->validate([
            'default_callout_fee' => 'nullable|numeric|min:0',
        ]);

        $customer->update(['default_callout_fee' => $data['default_callout_fee'] ?? null]);

        return response()->json($customer->fresh());
    }

    public function stats(): JsonResponse
    {
        return response()->json([
            'total'       => Customer::where('is_active', true)->count(),
            'residential' => Customer::where('is_active', true)->where('type', 'residential')->count(),
            'commercial'  => Customer::where('is_active', true)->where('type', 'commercial')->count(),
            'with_email'  => Customer::where('is_active', true)->whereNotNull('email')->count(),
        ]);
    }
}
