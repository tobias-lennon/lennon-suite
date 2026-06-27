<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'tobias@lennonlandscaping.ie'],
            [
                'name'     => 'Tobias Lennon',
                'email'    => 'tobias@lennonlandscaping.ie',
                'password' => Hash::make('Admin2026!'),
                'role'     => 'admin',
            ]
        );
    }
}
