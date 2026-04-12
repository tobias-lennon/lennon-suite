<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TestDataSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // ── Jobs ─────────────────────────────────────────────────────────────
        $jobs = [
            // Completed jobs — older
            [
                'customer_id'       => 1,  // Aine Philpot
                'title'             => 'Spring garden clearup',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> true,
                'priority'          => 'normal',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'full_day',
                'scheduled_date'    => '2025-03-14',
                'notes'             => null,
                'created_at'        => '2025-03-10 09:00:00',
                'updated_at'        => '2025-03-14 17:00:00',
            ],
            [
                'customer_id'       => 3,  // Ann O'Sullivan
                'title'             => 'Hedge trim front & back',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-04-22',
                'notes'             => 'Tall leylandii on western side, needs ladder',
                'created_at'        => '2025-04-18 10:00:00',
                'updated_at'        => '2025-04-22 14:00:00',
            ],
            [
                'customer_id'       => 6,  // Carmel Green
                'title'             => 'Monthly maintenance visit',
                'type'              => 'maintenance',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-05-08',
                'notes'             => null,
                'created_at'        => '2025-05-01 08:00:00',
                'updated_at'        => '2025-05-08 13:00:00',
            ],
            [
                'customer_id'       => 6,  // Carmel Green — returning
                'title'             => 'Monthly maintenance visit',
                'type'              => 'maintenance',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-06-05',
                'notes'             => null,
                'created_at'        => '2025-06-01 08:00:00',
                'updated_at'        => '2025-06-05 13:00:00',
            ],
            [
                'customer_id'       => 10, // Jerod & Mary Leman
                'title'             => 'Full garden redesign — phase 1',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> true,
                'priority'          => 'high',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'multi_day',
                'scheduled_date'    => '2025-06-16',
                'notes'             => 'Two-day job. Remove old raised beds, level lawn area, lay new edging.',
                'created_at'        => '2025-06-10 09:00:00',
                'updated_at'        => '2025-06-17 16:00:00',
            ],
            [
                'customer_id'       => 12, // John Randles
                'title'             => 'Lawn treatment & edging',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-07-03',
                'notes'             => null,
                'created_at'        => '2025-06-28 11:00:00',
                'updated_at'        => '2025-07-03 12:00:00',
            ],
            [
                'customer_id'       => 18, // Laurna & Jerry Hannon
                'title'             => 'Site visit — quote for patio',
                'type'              => 'site_visit',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'quick',
                'scheduled_date'    => '2025-07-11',
                'notes'             => 'Measuring up for rear patio, approx 40sqm',
                'created_at'        => '2025-07-09 14:00:00',
                'updated_at'        => '2025-07-11 11:00:00',
            ],
            [
                'customer_id'       => 20, // Marie & Darren Nagle
                'title'             => 'Overgrown back garden clearup',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> true,
                'priority'          => 'normal',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'full_day',
                'scheduled_date'    => '2025-08-14',
                'notes'             => null,
                'created_at'        => '2025-08-08 10:00:00',
                'updated_at'        => '2025-08-14 17:00:00',
            ],
            [
                'customer_id'       => 24, // Noirin Riordan
                'title'             => 'Autumn hedge trim',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-10-02',
                'notes'             => null,
                'created_at'        => '2025-09-28 09:00:00',
                'updated_at'        => '2025-10-02 13:00:00',
            ],
            [
                'customer_id'       => 6,  // Carmel Green — recurring
                'title'             => 'Monthly maintenance visit',
                'type'              => 'maintenance',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-11-06',
                'notes'             => null,
                'created_at'        => '2025-11-01 08:00:00',
                'updated_at'        => '2025-11-06 13:00:00',
            ],
            [
                'customer_id'       => 28, // Rosemarie Lennon
                'title'             => 'Winter tidy — shrubs & lawn edges',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> true,
                'priority'          => 'normal',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-11-20',
                'notes'             => null,
                'created_at'        => '2025-11-15 10:00:00',
                'updated_at'        => '2025-11-20 14:00:00',
            ],
            [
                'customer_id'       => 30, // Tom & Bridget O'Sullivan
                'title'             => 'Driveway border planting',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2025-12-04',
                'notes'             => 'Supply and plant 12x box balls along front border',
                'created_at'        => '2025-11-28 11:00:00',
                'updated_at'        => '2025-12-04 15:00:00',
            ],
            // Recent completed jobs — within 3 months
            [
                'customer_id'       => 1,  // Aine Philpot — returning customer
                'title'             => 'Spring hedge trim & tidy',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2026-02-12',
                'notes'             => null,
                'created_at'        => '2026-02-08 09:00:00',
                'updated_at'        => '2026-02-12 14:00:00',
            ],
            [
                'customer_id'       => 6,  // Carmel Green — still recurring
                'title'             => 'Monthly maintenance visit',
                'type'              => 'maintenance',
                'status'            => 'complete',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2026-02-19',
                'notes'             => null,
                'created_at'        => '2026-02-15 08:00:00',
                'updated_at'        => '2026-02-19 13:00:00',
            ],
            [
                'customer_id'       => 33, // Sean Murphy
                'title'             => 'Garden clearup & rubbish removal',
                'type'              => 'standard',
                'status'            => 'complete',
                'has_power_tools'   => true,
                'has_waste_disposal'=> true,
                'priority'          => 'high',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'full_day',
                'scheduled_date'    => '2026-03-07',
                'notes'             => 'Large back garden, lots of overgrowth',
                'created_at'        => '2026-03-03 09:00:00',
                'updated_at'        => '2026-03-07 17:00:00',
            ],
            // Scheduled / upcoming jobs
            [
                'customer_id'       => 19, // Maive & Dave Daly
                'title'             => 'Rear lawn levelling',
                'type'              => 'standard',
                'status'            => 'scheduled',
                'has_power_tools'   => true,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'full_day',
                'scheduled_date'    => '2026-04-17',
                'notes'             => null,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            [
                'customer_id'       => 22, // Mary Meade
                'title'             => 'Hedge trim — front garden',
                'type'              => 'standard',
                'status'            => 'scheduled',
                'has_power_tools'   => true,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'dry_only',
                'est_duration'      => 'quick',
                'scheduled_date'    => '2026-04-22',
                'notes'             => null,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            [
                'customer_id'       => 6,  // Carmel Green — next visit
                'title'             => 'Monthly maintenance visit',
                'type'              => 'maintenance',
                'status'            => 'scheduled',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'half_day',
                'scheduled_date'    => '2026-04-24',
                'notes'             => null,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            [
                'customer_id'       => 26, // Padraig Fitzgerald
                'title'             => 'Full garden overhaul',
                'type'              => 'standard',
                'status'            => 'scheduled',
                'has_power_tools'   => true,
                'has_waste_disposal'=> true,
                'priority'          => 'high',
                'weather_req'       => 'dry_preferred',
                'est_duration'      => 'multi_day',
                'scheduled_date'    => '2026-04-28',
                'notes'             => 'Two-day job. Remove old shed base, rotovate, reseed.',
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            // Backlog
            [
                'customer_id'       => 11, // John O'Sullivan
                'title'             => 'Quote follow-up — lawn care package',
                'type'              => 'site_visit',
                'status'            => 'backlog',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'quick',
                'scheduled_date'    => null,
                'notes'             => null,
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
            [
                'customer_id'       => null, // Internal
                'title'             => 'Equipment service & blade sharpening',
                'type'              => 'internal',
                'status'            => 'backlog',
                'has_power_tools'   => false,
                'has_waste_disposal'=> false,
                'priority'          => 'normal',
                'weather_req'       => 'any',
                'est_duration'      => 'quick',
                'scheduled_date'    => null,
                'notes'             => 'Hedgecutter blades + strimmer head',
                'created_at'        => $now,
                'updated_at'        => $now,
            ],
        ];

        DB::table('field_jobs')->insert($jobs);

        // Get inserted job IDs (skip the 2 that already existed)
        $jobIds = DB::table('field_jobs')->orderBy('id')->pluck('id')->toArray();
        // Map by title for reference
        $jobMap = DB::table('field_jobs')->orderBy('id')->get()->keyBy('title');

        // ── Work Logs (for completed jobs) ───────────────────────────────────
        $completedJobs = DB::table('field_jobs')
            ->where('status', 'complete')
            ->get();

        $logData = [];
        $entryData = [];

        $logDates = [
            'Spring garden clearup'              => [['2025-03-14', 6.0, true,  true]],
            'Hedge trim front & back'             => [['2025-04-22', 4.0, true,  false]],
            'Monthly maintenance visit'           => [['date', 3.0, false, false]], // placeholder, set per job
            'Full garden redesign — phase 1'      => [['2025-06-16', 7.0, true, true], ['2025-06-17', 5.0, true, true]],
            'Lawn treatment & edging'             => [['2025-07-03', 3.5, false, false]],
            'Site visit — quote for patio'        => [['2025-07-11', 1.0, false, false]],
            'Overgrown back garden clearup'       => [['2025-08-14', 7.0, true, true]],
            'Autumn hedge trim'                   => [['2025-10-02', 3.0, true, false]],
            'Winter tidy — shrubs & lawn edges'   => [['2025-11-20', 3.5, false, true]],
            'Driveway border planting'            => [['2025-12-04', 4.0, false, false]],
            'Spring hedge trim & tidy'            => [['2026-02-12', 3.0, true, false]],
            'Garden clearup & rubbish removal'    => [['2026-03-07', 7.5, true, true]],
        ];

        foreach ($completedJobs as $job) {
            $title = $job->title;
            $entries = $logDates[$title] ?? null;
            if (!$entries) continue;

            // For recurring maintenance, use the scheduled_date
            if ($job->type === 'maintenance') {
                $entries = [[$job->scheduled_date, 3.0, false, false]];
            }

            foreach ($entries as [$date, $hours, $powerTools, $waste]) {
                $logId = DB::table('work_logs')->insertGetId([
                    'field_job_id' => $job->id,
                    'date'         => $date,
                    'notes'        => null,
                    'created_at'   => $date . ' 08:00:00',
                    'updated_at'   => $date . ' 17:00:00',
                ]);

                // Calculate rate
                $baseRate = ($job->type === 'maintenance') ? 30.00 : 35.00;
                $rate = $baseRate
                    + ($powerTools ? 10.00 : 0)
                    + ($waste      ? 10.00 : 0);

                $charged = round($hours * $rate, 2);

                DB::table('work_log_entries')->insert([
                    'work_log_id'    => $logId,
                    'employee_id'    => 1, // Tobias
                    'billable_hours' => $hours,
                    'rate_per_hour'  => $rate,
                    'pay_rate'       => 0.00,
                    'discount_pct'   => 0.00,
                    'amount_charged' => $charged,
                    'amount_paid'    => 0.00,
                    'margin'         => $charged,
                    'created_at'     => $date . ' 17:00:00',
                    'updated_at'     => $date . ' 17:00:00',
                ]);
            }
        }

        // ── Leads ─────────────────────────────────────────────────────────────
        DB::table('leads')->insert([
            [
                'name'                  => 'Declan Sheehan',
                'phone'                 => '087 441 2233',
                'email'                 => null,
                'source'                => 'word_of_mouth',
                'status'                => 'new',
                'notes'                 => 'Enquired about a full garden clearup. Large plot, needs full day at least. Called Thursday.',
                'converted_customer_id' => null,
                'created_at'            => now()->subDays(2),
                'updated_at'            => now()->subDays(2),
            ],
            [
                'name'                  => 'Margaret O\'Connor',
                'phone'                 => '086 772 9910',
                'email'                 => 'margaret.oconnor@gmail.com',
                'source'                => 'google',
                'status'                => 'contacted',
                'notes'                 => 'Found us on Google. Wants monthly maintenance. Has about 0.25 acre. Spoke on Tuesday, sending quote.',
                'converted_customer_id' => null,
                'created_at'            => now()->subDays(5),
                'updated_at'            => now()->subDays(3),
            ],
            [
                'name'                  => 'Barry Dineen',
                'phone'                 => '085 330 6641',
                'email'                 => null,
                'source'                => 'instagram',
                'status'                => 'quoted',
                'notes'                 => 'Saw the before/after post on Instagram. Wants hedge trim + lawn edge tidy. Quoted €180.',
                'converted_customer_id' => null,
                'created_at'            => now()->subDays(9),
                'updated_at'            => now()->subDays(6),
            ],
            [
                'name'                  => 'Siobhan Buckley',
                'phone'                 => '087 900 1122',
                'email'                 => 'sbuckley@hotmail.com',
                'source'                => 'referral',
                'status'                => 'won',
                'notes'                 => 'Referred by Carmel Green. Wants same maintenance package. Agreed verbally.',
                'converted_customer_id' => null,
                'created_at'            => now()->subDays(14),
                'updated_at'            => now()->subDays(7),
            ],
            [
                'name'                  => 'Colm Twomey',
                'phone'                 => '086 219 8843',
                'email'                 => null,
                'source'                => 'word_of_mouth',
                'status'                => 'lost',
                'notes'                 => 'Wanted a large job done but went with someone cheaper. Price was the issue.',
                'converted_customer_id' => null,
                'created_at'            => now()->subDays(21),
                'updated_at'            => now()->subDays(12),
            ],
            [
                'name'                  => 'Patricia Walsh',
                'phone'                 => '089 445 7732',
                'email'                 => 'pwalsh@eircom.net',
                'source'                => 'google',
                'status'                => 'new',
                'notes'                 => 'Left a message via the website contact form. Wants a quote for garden redesign.',
                'converted_customer_id' => null,
                'created_at'            => now()->subHours(6),
                'updated_at'            => now()->subHours(6),
            ],
        ]);
    }
}
