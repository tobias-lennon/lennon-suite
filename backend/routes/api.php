<?php

use App\Http\Controllers\AddressLookupController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\RateCardController;
use App\Http\Controllers\WorkLogController;
use App\Http\Controllers\WorkLogEntryController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/auth/login', [AuthController::class, 'login']);

// Protected
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::get('/address/autocomplete', [AddressLookupController::class, 'autocomplete']);
    Route::get('/address/resolve', [AddressLookupController::class, 'resolve']);

    Route::get('/customers/stats', [CustomerController::class, 'stats']);
    Route::get('/customers/{customer}/history', [CustomerController::class, 'history']);
    Route::patch('/customers/{customer}/archive', [CustomerController::class, 'archive']);
    Route::apiResource('/customers', CustomerController::class);

    // Leads
    Route::post('/leads/{lead}/convert', [LeadController::class, 'convert']);
    Route::apiResource('/leads', LeadController::class);

    // Jobs
    Route::patch('/jobs/{job}/status', [JobController::class, 'updateStatus']);
    Route::apiResource('/jobs', JobController::class)->parameters(['jobs' => 'job']);

    // Work logs (nested under jobs)
    Route::get('/jobs/{job}/logs', [WorkLogController::class, 'index']);
    Route::post('/jobs/{job}/logs', [WorkLogController::class, 'store']);
    Route::get('/jobs/{job}/logs/{log}', [WorkLogController::class, 'show']);
    Route::patch('/jobs/{job}/logs/{log}', [WorkLogController::class, 'update']);
    Route::delete('/jobs/{job}/logs/{log}', [WorkLogController::class, 'destroy']);

    // Work log entries and materials (nested under log ID)
    Route::post('/logs/{log}/entries', [WorkLogEntryController::class, 'store']);
    Route::patch('/logs/{log}/entries/{entry}', [WorkLogEntryController::class, 'update']);
    Route::delete('/logs/{log}/entries/{entry}', [WorkLogEntryController::class, 'destroy']);

    Route::post('/logs/{log}/materials', [MaterialController::class, 'store']);
    Route::patch('/logs/{log}/materials/{material}', [MaterialController::class, 'update']);
    Route::delete('/logs/{log}/materials/{material}', [MaterialController::class, 'destroy']);

    // Invoices
    Route::get('/invoices/{invoice}/download', [InvoiceController::class, 'downloadPdf']);
    Route::get('/invoices/{invoice}/receipt', [InvoiceController::class, 'downloadReceipt']);
    Route::post('/invoices/{invoice}/payment', [InvoiceController::class, 'recordPayment']);
    Route::patch('/invoices/{invoice}/status', [InvoiceController::class, 'updateStatus']);
    Route::apiResource('/invoices', InvoiceController::class)->only(['index', 'store', 'show', 'destroy']);

    // Reference data
    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::get('/rate-cards', [RateCardController::class, 'index']);

    // Customer discount
    Route::patch('/customers/{customer}/discount', [CustomerController::class, 'setDiscount']);
});
