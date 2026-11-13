<?php
declare(strict_types=1);

namespace SneakerLab;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;

/** Tokens JWT HS256 (7 días) y contraseñas bcrypt, compatibles con el API anterior. */
final class Auth
{
    public static function hashPassword(string $plain): string
    {
        return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 10]);
    }

    public static function verifyPassword(string $plain, string $hash): bool
    {
        // bcryptjs genera $2a$/$2b$; son el mismo algoritmo que $2y$ de PHP.
        if (str_starts_with($hash, '$2b$') || str_starts_with($hash, '$2a$')) $hash = '$2y$' . substr($hash, 4);
        return password_verify($plain, $hash);
    }

    /** @param array{id:string,role:string,email:string} $user */
    public static function signToken(array $user, string $secret, int $ttlSeconds = 7 * 86400): string
    {
        $now = time();
        return JWT::encode(['role' => $user['role'], 'email' => $user['email'], 'sub' => $user['id'], 'iat' => $now, 'exp' => $now + $ttlSeconds], $secret, 'HS256');
    }

    /** @return array{sub:string,role:string,email:string}|null */
    public static function verifyToken(string $token, string $secret): ?array
    {
        try {
            $p = JWT::decode($token, new Key($secret, 'HS256'));
        } catch (\Throwable) {
            return null;
        }
        if (empty($p->sub) || !is_string($p->role ?? null)) return null;
        return ['sub' => (string) $p->sub, 'role' => $p->role, 'email' => (string) ($p->email ?? '')];
    }

    /** @param array<string,mixed> $u */
    public static function publicUser(array $u): array
    {
        return ['id' => $u['id'], 'email' => $u['email'], 'name' => $u['name'], 'role' => $u['role'], 'createdAt' => Http::iso($u['created_at'])];
    }
}
