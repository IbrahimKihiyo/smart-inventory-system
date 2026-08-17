<?php
// app/Http/Controllers/AuthController.php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    /** Number of failed login attempts allowed before a temporary lockout. */
    private const MAX_ATTEMPTS = 5;

    /** How long (seconds) the attempt counter is kept, and the lockout lasts. */
    private const DECAY_SECONDS = 60;

    public function register(Request $request)
    {
        // Bot trap: a genuine client never fills this hidden field.
        if ($this->looksLikeBot($request)) {
            return response()->json(['message' => 'Request rejected.'], 422);
        }

        // Only the expected fields are accepted, so injected fields are rejected.
        if ($extra = $this->unexpectedFields($request, ['name', 'email', 'password', 'website'])) {
            return response()->json(['message' => 'Unexpected fields in the request.'], 422);
        }

        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => ['required', 'email', Rule::unique('tenant.users', 'email')],
            'password' => 'required|min:6',
        ]);

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => 'user',
        ]);

        return response()->json(['user' => $user], 201);
    }

    public function login(Request $request)
    {
        // 1) Bot detection: reject if the honeypot field was filled in.
        if ($this->looksLikeBot($request)) {
            return response()->json(['message' => 'Request rejected.'], 422);
        }

        // 2) Field tampering: reject any field that is not expected here.
        if ($this->unexpectedFields($request, ['email', 'password', 'website'])) {
            return response()->json(['message' => 'Unexpected fields in the request.'], 422);
        }

        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        // 3) Rate limiting, keyed by the email and the caller's address, so a
        //    single account or address cannot be hammered with guesses.
        $key = $this->throttleKey($request);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message'     => "Too many login attempts. Please wait {$seconds} seconds and try again.",
                'retry_after' => $seconds,
            ], 429);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            // Deliberately generic: never reveal whether the email or the
            // password was the wrong one (prevents account enumeration).
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Successful login clears the failed-attempt counter.
        RateLimiter::clear($key);

        // Remove old tokens so they do not accumulate.
        $user->tokens()->delete();

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    /* ---------------------------------------------------------------------- */

    /**
     * Honeypot check. The mobile application never sends a "website" field, so
     * if one arrives with a value it is almost certainly an automated script.
     */
    private function looksLikeBot(Request $request): bool
    {
        return filled($request->input('website'));
    }

    /**
     * Returns true when the request carries any field that is not on the
     * allowed list, which is a sign of tampering or a malformed client.
     */
    private function unexpectedFields(Request $request, array $allowed): bool
    {
        return count(array_diff(array_keys($request->all()), $allowed)) > 0;
    }

    /**
     * The key used for rate limiting: the email address plus the caller's IP.
     */
    private function throttleKey(Request $request): string
    {
        return 'login:' . Str::lower((string) $request->input('email')) . '|' . $request->ip();
    }
}
