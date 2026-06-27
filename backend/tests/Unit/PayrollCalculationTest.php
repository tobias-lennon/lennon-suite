<?php

namespace Tests\Unit;

use App\Http\Controllers\PayrollController;
use App\Models\Employee;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Unit tests for PayrollController::calculate() — Irish 2025 tax rules.
 *
 * The method is private, so we invoke it via reflection. No database is
 * touched; Employee instances are constructed without persisting.
 *
 * Tax rules under test:
 *   PAYE : 20% up to std_rate_cutoff_weekly, 40% above, minus weekly_tax_credits (floor 0)
 *   PRSI : employee 0% if gross <= 352, otherwise 4%; employer 8.8% / 11.15%
 *   USC  : standard bands (weekly) — 231 @ 0.5%, 264.38 @ 2%, 851.62 @ 4%, rest @ 8%
 *          reduced (medical card) — max 2% on all bands
 *          exempt — 0
 *   net  : gross − paye − prsi_employee − usc (floor 0)
 */
class PayrollCalculationTest extends TestCase
{
    // ── Reflection helper ─────────────────────────────────────────────────────

    /**
     * Call PayrollController::calculate(Employee, float) via reflection.
     *
     * @return array{gross_pay:float, paye:float, prsi_employee:float, prsi_employer:float, usc:float, net_pay:float}
     */
    private function calculate(Employee $employee, float $hours): array
    {
        $controller = new PayrollController();
        $method     = new ReflectionMethod(PayrollController::class, 'calculate');
        $method->setAccessible(true);

        return $method->invoke($controller, $employee, $hours);
    }

    /**
     * Build an Employee stub without touching the DB.
     */
    private function makeEmployee(array $attrs = []): Employee
    {
        $employee = new Employee();
        $employee->setRawAttributes(array_merge([
            'pay_rate'               => 15.00,
            'weekly_tax_credits'     => 100.00,
            'std_rate_cutoff_weekly' => 600.00,
            'usc_status'             => 'standard',
        ], $attrs));

        return $employee;
    }

    // ── Low earner (gross = 200) ───────────────────────────────────────────────

    /**
     * gross = 200 (below PRSI threshold of 352)
     *   PRSI employee: 0
     *   PRSI employer: 200 × 8.8% = 17.60
     *   PAYE: 200 × 20% = 40 − 100 credits = 0  (floor)
     *   USC:  200 × 0.5% = 1.00  (all within first band of 231)
     *   net:  200 − 0 − 0 − 1.00 = 199.00
     */
    public function test_low_earner_below_prsi_threshold(): void
    {
        // 200 / 15 pay_rate = 13.333... hours; use hours directly so gross = 200.00
        $employee = $this->makeEmployee(['pay_rate' => 200.00]);
        $result   = $this->calculate($employee, 1.0); // 1 hr × €200 = €200 gross

        $this->assertSame(200.0,  $result['gross_pay']);
        $this->assertSame(0.0,    $result['prsi_employee'],  'No employee PRSI below threshold');
        $this->assertSame(17.60,  $result['prsi_employer'],  'Employer PRSI 8.8%');
        $this->assertSame(0.0,    $result['paye'],           'Tax credits wipe PAYE');
        $this->assertSame(1.00,   $result['usc'],            'First USC band only at 0.5%');
        $this->assertSame(199.0,  $result['net_pay']);
    }

    /**
     * Sanity-check with explicit hours × pay_rate combination:
     * 10 hrs × €15 = €150 gross — below PRSI threshold.
     *
     *   PRSI employee: 0
     *   PRSI employer: 150 × 8.8% = 13.20
     *   PAYE: 150 × 20% = 30 − 100 credits → 0  (floor)
     *   USC:  150 × 0.5% = 0.75
     *   net:  150 − 0 − 0 − 0.75 = 149.25
     */
    public function test_low_earner_with_standard_pay_rate(): void
    {
        $employee = $this->makeEmployee();  // pay_rate = 15, credits = 100, cutoff = 600
        $result   = $this->calculate($employee, 10.0);

        $this->assertSame(150.0,  $result['gross_pay']);
        $this->assertSame(0.0,    $result['prsi_employee']);
        $this->assertSame(13.20,  $result['prsi_employer']);
        $this->assertSame(0.0,    $result['paye']);
        $this->assertSame(0.75,   $result['usc']);
        $this->assertSame(149.25, $result['net_pay']);
    }

    // ── Standard earner (gross = 700) ─────────────────────────────────────────

    /**
     * gross = 700 (above PRSI threshold; PAYE spans both bands)
     *   PAYE: (600 × 20%) + (100 × 40%) − 100 credits = 120 + 40 − 100 = 60.00
     *   PRSI employee: 700 × 4% = 28.00
     *   PRSI employer: 700 × 11.15% = 78.05
     *   USC:  231 × 0.5% = 1.155
     *         264.38 × 2% = 5.2876
     *         (700 − 231 − 264.38) × 4% = 204.62 × 4% = 8.1848
     *         total ≈ 14.63  (rounded to 2dp)
     *   net:  700 − 60 − 28 − 14.63 = 597.37
     */
    public function test_standard_earner_above_prsi_threshold(): void
    {
        $employee = $this->makeEmployee(['pay_rate' => 700.00]);
        $result   = $this->calculate($employee, 1.0);

        $this->assertSame(700.0, $result['gross_pay']);

        $this->assertSame(60.0,  $result['paye'],          'PAYE split across both bands minus credits');
        $this->assertSame(28.0,  $result['prsi_employee'], '4% employee PRSI');
        $this->assertSame(78.05, $result['prsi_employer'], '11.15% employer PRSI');

        // USC: 231×0.005 + 264.38×0.02 + 204.62×0.04 = 1.155 + 5.2876 + 8.1848 = 14.6274 → 14.63
        $this->assertSame(14.63, $result['usc'], 'USC across three bands');

        $expectedNet = round(700.0 - 60.0 - 28.0 - 14.63, 2);
        $this->assertSame($expectedNet, $result['net_pay']);
    }

    // ── High earner (gross = 2000) ────────────────────────────────────────────

    /**
     * gross = 2000 (well above cutoff; hits the 8% USC band)
     *   PAYE: (600 × 20%) + (1400 × 40%) − 100 = 120 + 560 − 100 = 580.00
     *   PRSI employee: 2000 × 4% = 80.00
     *   PRSI employer: 2000 × 11.15% = 223.00
     *   USC:  231 × 0.5%    = 1.155
     *         264.38 × 2%   = 5.2876
     *         851.62 × 4%   = 34.0648
     *         remaining: 2000 − 231 − 264.38 − 851.62 = 653 × 8% = 52.24
     *         total ≈ 92.75  (rounded)
     *   net:  2000 − 580 − 80 − 92.75 = 1247.25
     */
    public function test_high_earner_hits_top_usc_band(): void
    {
        $employee = $this->makeEmployee(['pay_rate' => 2000.00]);
        $result   = $this->calculate($employee, 1.0);

        $this->assertSame(2000.0, $result['gross_pay']);
        $this->assertSame(580.0,  $result['paye'],          '20%/40% PAYE split minus credits');
        $this->assertSame(80.0,   $result['prsi_employee'], '4% employee PRSI');
        $this->assertSame(223.0,  $result['prsi_employer'], '11.15% employer PRSI');

        // USC: 1.155 + 5.2876 + 34.0648 + 52.24 = 92.7474 → 92.75
        $this->assertSame(92.75, $result['usc'], 'USC spans all four bands including 8%');

        $expectedNet = round(2000.0 - 580.0 - 80.0 - 92.75, 2);
        $this->assertSame($expectedNet, $result['net_pay']);
    }

    // ── USC exempt ────────────────────────────────────────────────────────────

    /**
     * Exempt employees pay zero USC regardless of gross.
     */
    public function test_usc_exempt_employee_pays_no_usc(): void
    {
        $employee = $this->makeEmployee([
            'usc_status' => 'exempt',
            'pay_rate'   => 700.00,
        ]);
        $result = $this->calculate($employee, 1.0);

        $this->assertSame(0.0, $result['usc'], 'USC exempt means zero USC');
        // Sanity: other deductions still apply
        $this->assertGreaterThan(0.0, $result['paye']);
        $this->assertGreaterThan(0.0, $result['prsi_employee']);
    }

    // ── USC reduced (medical card) ────────────────────────────────────────────

    /**
     * Reduced-rate employees never exceed 2% on any band.
     * gross = 700:
     *   USC reduced: 231 × 0.5% + (700 − 231) × 2% = 1.155 + 9.38 = 10.535 → 10.54
     *   Standard for same gross would be 14.63 (see earlier test).
     */
    public function test_usc_reduced_employee_capped_at_2_percent(): void
    {
        $reduced  = $this->makeEmployee(['usc_status' => 'reduced',  'pay_rate' => 700.00]);
        $standard = $this->makeEmployee(['usc_status' => 'standard', 'pay_rate' => 700.00]);

        $reducedResult  = $this->calculate($reduced, 1.0);
        $standardResult = $this->calculate($standard, 1.0);

        // Reduced USC must be strictly lower than standard USC for this gross
        $this->assertLessThan($standardResult['usc'], $reducedResult['usc']);

        // Reduced: 231×0.005 + 469×0.02 = 1.155 + 9.38 = 10.535 → 10.54
        $this->assertSame(10.54, $reducedResult['usc'], 'Reduced USC capped at 2% above first band');
    }

    /**
     * Reduced rate for a high earner — still max 2% on all income above first band.
     * gross = 2000:
     *   USC reduced: 231 × 0.5% + (2000 − 231) × 2% = 1.155 + 35.38 = 36.535 → 36.54
     */
    public function test_usc_reduced_high_earner_never_exceeds_2_percent(): void
    {
        $employee = $this->makeEmployee([
            'usc_status' => 'reduced',
            'pay_rate'   => 2000.00,
        ]);
        $result = $this->calculate($employee, 1.0);

        // 231×0.005 + 1769×0.02 = 1.155 + 35.38 = 36.535 → 36.54
        $this->assertSame(36.54, $result['usc'], 'High earner on reduced USC stays at max 2%');
    }

    // ── PAYE floor at zero ────────────────────────────────────────────────────

    /**
     * When tax credits exceed the gross × 20% raw tax, PAYE must floor at 0.
     * gross = 50; credits = 100:
     *   raw PAYE = 50 × 20% = 10; after credits = 10 − 100 = −90 → clamped to 0
     */
    public function test_paye_cannot_be_negative(): void
    {
        $employee = $this->makeEmployee([
            'pay_rate'               => 50.00,
            'weekly_tax_credits'     => 100.00,
            'std_rate_cutoff_weekly' => 600.00,
        ]);
        $result = $this->calculate($employee, 1.0); // gross = 50

        $this->assertSame(0.0, $result['paye'], 'PAYE must floor at 0 when credits exceed raw tax');
        // net_pay = 50 - 0 - 0 - (50×0.5%) = 50 - 0.25 = 49.75
        $this->assertSame(49.75, $result['net_pay']);
    }

    // ── net_pay consistency ───────────────────────────────────────────────────

    /**
     * Verify net_pay always equals gross − paye − prsi_employee − usc for several
     * different scenarios. This is a structural invariant of the calculate() method.
     */
    public function test_net_pay_equals_gross_minus_deductions(): void
    {
        $scenarios = [
            ['pay_rate' => 15.00,   'hours' => 10.0],   // low earner
            ['pay_rate' => 100.00,  'hours' => 7.0],    // medium earner
            ['pay_rate' => 300.00,  'hours' => 7.0],    // high earner
        ];

        foreach ($scenarios as $scenario) {
            $employee = $this->makeEmployee(['pay_rate' => $scenario['pay_rate']]);
            $result   = $this->calculate($employee, $scenario['hours']);

            $expected = round(
                $result['gross_pay'] - $result['paye'] - $result['prsi_employee'] - $result['usc'],
                2
            );

            $this->assertSame(
                $expected,
                $result['net_pay'],
                "net_pay invariant failed for pay_rate={$scenario['pay_rate']} hours={$scenario['hours']}"
            );
        }
    }
}
