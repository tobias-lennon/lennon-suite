<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    private const WMO_CONDITIONS = [
        0  => 'dry',    // Clear sky
        1  => 'dry',    // Mainly clear
        2  => 'dry',    // Partly cloudy
        3  => 'dry',    // Overcast (cloud, no rain)
        45 => 'dry',    // Fog
        48 => 'dry',    // Icy fog
        51 => 'shower', // Light drizzle
        53 => 'shower', // Moderate drizzle
        55 => 'shower', // Dense drizzle
        61 => 'shower', // Slight rain
        63 => 'shower', // Moderate rain
        65 => 'rain',   // Heavy rain
        71 => 'shower', // Slight snow
        73 => 'shower', // Moderate snow
        75 => 'shower', // Heavy snow
        77 => 'shower', // Snow grains
        80 => 'shower', // Slight showers
        81 => 'shower', // Moderate showers
        82 => 'rain',   // Violent showers
        85 => 'shower', // Snow showers
        86 => 'shower', // Heavy snow showers
        95 => 'rain',   // Thunderstorm
        96 => 'rain',   // Thunderstorm with hail
        99 => 'rain',   // Thunderstorm with heavy hail
    ];

    public function getForecast(float $lat, float $lng, int $days = 7): array
    {
        $cacheKey = "weather_{$lat}_{$lng}";

        return Cache::remember($cacheKey, 3600, function () use ($lat, $lng, $days) {
            return $this->fetchForecast($lat, $lng, $days);
        });
    }

    private function fetchForecast(float $lat, float $lng, int $days): array
    {
        try {
            $response = Http::timeout(8)->get('https://api.open-meteo.com/v1/forecast', [
                'latitude'                     => $lat,
                'longitude'                    => $lng,
                'daily'                        => 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
                'hourly'                       => 'precipitation_probability,precipitation,weathercode',
                'timezone'                     => 'Europe/Dublin',
                'forecast_days'                => $days,
                'models'                       => 'best_match',
            ]);

            $data = $response->json();
            $daily  = $data['daily'] ?? [];
            $hourly = $data['hourly'] ?? [];

            // Index hourly data by date for quick lookup
            $hourlyByDate = [];
            foreach ($hourly['time'] ?? [] as $hi => $dt) {
                [$dateStr, $timeStr] = explode('T', $dt);
                $hour = (int) substr($timeStr, 0, 2);
                if ($hour >= 7 && $hour <= 19) {
                    $hourlyByDate[$dateStr][] = [
                        'hour'      => $timeStr,
                        'prob'      => (int) ($hourly['precipitation_probability'][$hi] ?? 0),
                        'precip_mm' => round((float) ($hourly['precipitation'][$hi] ?? 0), 1),
                        'code'      => (int) ($hourly['weathercode'][$hi] ?? 0),
                    ];
                }
            }

            $forecasts = [];
            foreach ($daily['time'] ?? [] as $i => $date) {
                $code      = (int) ($daily['weathercode'][$i] ?? 0);
                $condition = self::WMO_CONDITIONS[$code] ?? 'mixed';

                // Build hourly summary: only hours with significant rain chance
                $hourlyDetail = [];
                foreach ($hourlyByDate[$date] ?? [] as $h) {
                    $hourlyDetail[] = [
                        'hour'      => $h['hour'],
                        'prob'      => $h['prob'],
                        'precip_mm' => $h['precip_mm'],
                        'condition' => self::WMO_CONDITIONS[$h['code']] ?? 'shower',
                    ];
                }

                $forecasts[] = [
                    'date'               => $date,
                    'day'                => date('D', strtotime($date)),
                    'condition'          => $condition,
                    'temp_max'           => (int) round($daily['temperature_2m_max'][$i] ?? 0),
                    'temp_min'           => (int) round($daily['temperature_2m_min'][$i] ?? 0),
                    'precip_probability' => (int) ($daily['precipitation_probability_max'][$i] ?? 0),
                    'precip_mm'          => round((float) ($daily['precipitation_sum'][$i] ?? 0), 1),
                    'weather_code'       => $code,
                    'hourly'             => $hourlyDetail,
                ];
            }

            return $forecasts;
        } catch (\Throwable $e) {
            Log::warning('Weather fetch failed', ['error' => $e->getMessage()]);
            return [];
        }
    }
}
