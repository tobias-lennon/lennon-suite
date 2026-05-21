<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\CustomerFollowupController;
use App\Http\Controllers\JobTaskController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\RateCardController;
use App\Http\Controllers\WeatherController;
use App\Http\Controllers\WorkLogController;
use App\Http\Controllers\WorkLogEntryController;
use Illuminate\Support\Facades\Route;

// Public — rate limited to 10 attempts per minute per IP
Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

// All authenticated users
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',     [AuthController::class, 'me']);

    // Profile (own account — any role)
    Route::patch('/users/me/password', [UserController::class, 'updatePassword']);
    Route::post('/users/me/avatar',    [UserController::class, 'updateAvatar']);
    Route::delete('/users/me/avatar',  [UserController::class, 'removeAvatar']);

    // Read-only access (admin + field)
    Route::middleware('role:admin,field')->group(function () {
        Route::get('/customers/stats',              [CustomerController::class, 'stats']);
        Route::get('/customers/{customer}/history', [CustomerController::class, 'history']);
        Route::apiResource('/customers', CustomerController::class)->only(['index', 'show']);

        Route::apiResource('/leads', LeadController::class)->only(['index', 'show']);

        Route::patch('/jobs/{job}/status', [JobController::class, 'updateStatus']);
        Route::apiResource('/jobs', JobController::class)
            ->parameters(['jobs' => 'job'])
            ->only(['index', 'show']);

        Route::get('/jobs/{job}/logs',         [WorkLogController::class, 'index']);
        Route::get('/jobs/{job}/logs/{log}',   [WorkLogController::class, 'show']);

        Route::apiResource('/invoices', InvoiceController::class)->only(['index', 'show']);
        Route::get('/invoices/{invoice}/download', [InvoiceController::class, 'downloadPdf']);
        Route::get('/invoices/{invoice}/receipt',  [InvoiceController::class, 'downloadReceipt']);

        Route::get('/settings',    [SettingsController::class, 'show']);
        Route::get('/employees',   [EmployeeController::class, 'index']);
        Route::get('/rate-cards',  [RateCardController::class, 'index']);

        Route::get('/weather',                          [WeatherController::class, 'hq']);
        Route::get('/weather/customers/{customer}',     [WeatherController::class, 'forCustomer']);

        Route::get('/schedule',                             [ScheduleController::class, 'week']);
        Route::patch('/schedule/jobs/{job}/date',         [ScheduleController::class, 'updateDate']);
        Route::patch('/schedule/tasks/{task}/date',       [ScheduleController::class, 'updateTaskDate']);

        Route::apiResource('/contacts', ContactController::class)->only(['index', 'show']);

        Route::get('/customer-followups/upcoming', [CustomerFollowupController::class, 'upcoming']);
    });

    // Write access — field staff can log work
    Route::middleware('role:admin,field')->group(function () {
        Route::post('/jobs/{job}/logs',            [WorkLogController::class, 'store']);
        Route::patch('/jobs/{job}/logs/{log}',     [WorkLogController::class, 'update']);
        Route::delete('/jobs/{job}/logs/{log}',    [WorkLogController::class, 'destroy']);

        Route::post('/logs/{log}/entries',                      [WorkLogEntryController::class, 'store']);
        Route::patch('/logs/{log}/entries/{entry}',             [WorkLogEntryController::class, 'update']);
        Route::delete('/logs/{log}/entries/{entry}',            [WorkLogEntryController::class, 'destroy']);

        Route::post('/logs/{log}/materials',                    [MaterialController::class, 'store']);
        Route::patch('/logs/{log}/materials/{material}',        [MaterialController::class, 'update']);
        Route::delete('/logs/{log}/materials/{material}',       [MaterialController::class, 'destroy']);
    });

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::patch('/customers/{customer}/archive',   [CustomerController::class, 'archive']);
        Route::apiResource('/customers', CustomerController::class)->only(['store', 'update', 'destroy']);

        Route::patch('/customers/{customer}/discount',  [CustomerController::class, 'setDiscount']);
        Route::patch('/customers/{customer}/rates',     [CustomerController::class, 'setRates']);

        Route::apiResource('/leads', LeadController::class)->only(['store', 'update', 'destroy']);
        Route::post('/leads/{lead}/convert',            [LeadController::class, 'convert']);

        Route::apiResource('/jobs', JobController::class)
            ->parameters(['jobs' => 'job'])
            ->only(['store', 'update', 'destroy']);

        Route::post('/jobs/{job}/tasks',             [JobTaskController::class, 'store']);
        Route::patch('/jobs/{job}/tasks/{task}',     [JobTaskController::class, 'update']);
        Route::delete('/jobs/{job}/tasks/{task}',    [JobTaskController::class, 'destroy']);

        Route::apiResource('/invoices', InvoiceController::class)->only(['store', 'destroy']);
        Route::post('/invoices/{invoice}/payment',      [InvoiceController::class, 'recordPayment']);
        Route::patch('/invoices/{invoice}/status',      [InvoiceController::class, 'updateStatus']);

        Route::patch('/settings', [SettingsController::class, 'update']);

        Route::apiResource('/contacts', ContactController::class)->only(['store', 'update', 'destroy']);

        Route::post('/customers/{customer}/followups',      [CustomerFollowupController::class, 'store']);
        Route::patch('/customer-followups/{followup}',      [CustomerFollowupController::class, 'update']);
        Route::delete('/customer-followups/{followup}',     [CustomerFollowupController::class, 'destroy']);
    });
});
