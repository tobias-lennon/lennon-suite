<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_line_items', function (Blueprint $table) {
            $table->string('unit', 50)->nullable()->after('quantity');
        });

        // Backfill: parse "(qty unit)" or "(qty)" from existing material descriptions
        $items = DB::table('invoice_line_items')->where('type', 'material')->get();
        foreach ($items as $item) {
            // Matches: "Name (1.5 trailer)" or "Name (0.6 Bag)" — qty + optional unit
            if (preg_match('/^(.+?)\s+\(\d+\.?\d*\s+(.+)\)$/', $item->description, $m)) {
                DB::table('invoice_line_items')->where('id', $item->id)->update([
                    'description' => trim($m[1]),
                    'unit'        => trim($m[2]),
                ]);
            } elseif (preg_match('/^(.+?)\s+\(\d+\.?\d*\)$/', $item->description, $m)) {
                // Qty in parens but no unit — just strip it
                DB::table('invoice_line_items')->where('id', $item->id)->update([
                    'description' => trim($m[1]),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('invoice_line_items', function (Blueprint $table) {
            $table->dropColumn('unit');
        });
    }
};
