<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function updatePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', Password::min(8)],
        ]);

        if (! Hash::check($request->current_password, $request->user()->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $request->user()->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json(['message' => 'Password updated.']);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $request->validate([
            'avatar' => 'required|file|max:10240|mimes:jpg,jpeg,png,webp,gif',
        ]);

        $user = $request->user();

        // Read uploaded file and convert to JPEG via GD so any browser can display it
        $filePath = $request->file('avatar')->getRealPath();
        $rawBytes = file_get_contents($filePath);
        $image    = @imagecreatefromstring($rawBytes);

        if ($image === false) {
            return response()->json([
                'errors' => ['avatar' => ['Could not read image. Please use JPEG, PNG, or WEBP format.']],
            ], 422);
        }

        // Correct rotation from EXIF orientation tag (phones often store images sideways)
        $exif        = @exif_read_data($filePath);
        $orientation = $exif['Orientation'] ?? 1;
        $image       = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        // Build storage path
        $dir      = storage_path("app/public/avatars/{$user->id}");
        $filename = uniqid('av_', true) . '.jpg';
        $fullPath = "{$dir}/{$filename}";

        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Delete old avatar file if present
        if ($user->avatar) {
            $oldFile = storage_path('app/public' . $user->avatar);
            if (file_exists($oldFile)) {
                unlink($oldFile);
            }
        }

        imagejpeg($image, $fullPath, 88);
        imagedestroy($image);

        $url = "/storage/avatars/{$user->id}/{$filename}";
        $user->update(['avatar' => $url]);

        return response()->json(['avatar' => $url]);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar) {
            $oldFile = storage_path('app/public' . $user->avatar);
            if (file_exists($oldFile)) {
                unlink($oldFile);
            }
            $user->update(['avatar' => null]);
        }

        return response()->json(['avatar' => null]);
    }
}
