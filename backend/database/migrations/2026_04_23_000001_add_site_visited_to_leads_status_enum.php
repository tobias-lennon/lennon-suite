<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE leads MODIFY status ENUM('new','contacted','quoted','site_visited','won','lost') NOT NULL DEFAULT 'new'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE leads MODIFY status ENUM('new','contacted','quoted','won','lost') NOT NULL DEFAULT 'new'");
    }
};
