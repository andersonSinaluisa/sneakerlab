<?php
declare(strict_types=1);

namespace SneakerLab;

/** Configuración leída de .env (junto a composer.json) y del entorno, con valores seguros en desarrollo. */
final class Config
{
    public function __construct(
        public readonly string $env,
        public readonly string $dbDsn,
        public readonly string $dbUser,
        public readonly string $dbPassword,
        public readonly string $jwtSecret,
        /** @var string[] */
        public readonly array $corsOrigins,
        public readonly string $storageDir,
        public readonly string $uploadsPublicBase,
        public readonly int $maxUploadBytes,
        public readonly int $quoteTtlHours,
        public readonly ?string $adminEmail,
        public readonly ?string $adminPassword,
    ) {}

    public static function load(string $root): self
    {
        $file = $root . '/.env';
        $vars = is_file($file) ? self::parseDotenv((string) file_get_contents($file)) : [];
        $get = static function (string $k, ?string $default = null) use ($vars): ?string {
            $v = getenv($k);
            if ($v !== false && $v !== '') return $v;
            return ($vars[$k] ?? '') !== '' ? $vars[$k] : $default;
        };

        $env = $get('APP_ENV', 'production');
        $secret = $get('JWT_SECRET', $env === 'production' ? '' : 'dev-secret-change-me-please-32chars!!');
        // php-jwt 7 exige claves HS256 de al menos 32 bytes.
        if (strlen((string) $secret) < 32) {
            throw new \RuntimeException('JWT_SECRET debe tener al menos 32 caracteres');
        }
        $storage = (string) $get('STORAGE_DIR', 'storage/uploads');
        if (!preg_match('#^(/|[A-Za-z]:[\\\\/])#', $storage)) $storage = $root . '/' . $storage;

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $get('DB_HOST', 'localhost'), $get('DB_PORT', '3306'), $get('DB_NAME', 'sneakerlab'));

        return new self(
            env: (string) $env,
            dbDsn: $dsn,
            dbUser: (string) $get('DB_USER', 'root'),
            dbPassword: (string) $get('DB_PASSWORD', ''),
            jwtSecret: (string) $secret,
            corsOrigins: array_values(array_filter(array_map('trim', explode(',', (string) $get('CORS_ORIGINS', ''))))),
            storageDir: rtrim($storage, '/\\'),
            uploadsPublicBase: rtrim((string) $get('UPLOADS_PUBLIC_BASE', '/uploads'), '/'),
            maxUploadBytes: (int) $get('MAX_UPLOAD_BYTES', (string) (16 * 1024 * 1024)),
            quoteTtlHours: (int) $get('QUOTE_TTL_HOURS', '72'),
            adminEmail: $get('ADMIN_EMAIL'),
            adminPassword: $get('ADMIN_PASSWORD'),
        );
    }

    /** @return array<string,string> */
    private static function parseDotenv(string $text): array
    {
        $out = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
            [$k, $v] = array_map('trim', explode('=', $line, 2));
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[-1] === $v[0]) $v = substr($v, 1, -1);
            $out[$k] = $v;
        }
        return $out;
    }

    public function isTest(): bool
    {
        return $this->env === 'test';
    }
}
