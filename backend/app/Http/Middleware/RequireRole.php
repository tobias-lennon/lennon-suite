<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $userRole = $request->user()?->role?->value;

        if (!$userRole || !in_array($userRole, $roles, strict: true)) {
            abort(403, 'Insufficient permissions.');
        }

        return $next($request);
    }
}
