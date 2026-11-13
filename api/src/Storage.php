<?php
declare(strict_types=1);

namespace SneakerLab;

/**
 * Imágenes subidas en disco (fuera de public_html). El cliente hace PUT /uploads/<clave> y el API
 * las sirve en GET /uploads/<clave>.
 */
final class Storage
{
    public function __construct(private readonly string $dir, private readonly string $publicBase) {}

    public static function safeKey(string $key): string
    {
        $key = str_replace('\\', '/', $key);
        if ($key === '' || str_contains($key, '..') || str_starts_with($key, '/') || !preg_match('#^[A-Za-z0-9/_.-]+$#', $key)) {
            throw new HttpError(400, 'clave inválida');
        }
        return $key;
    }

    private function path(string $key): string
    {
        return $this->dir . '/' . self::safeKey($key);
    }

    public function publicUrl(string $key): string
    {
        return $this->publicBase . '/' . self::safeKey($key);
    }

    public function size(string $key): ?int
    {
        $p = $this->path($key);
        return is_file($p) ? (int) filesize($p) : null;
    }

    public function write(string $key, string $body): void
    {
        $p = $this->path($key);
        if (!is_dir(dirname($p)) && !mkdir(dirname($p), 0775, true) && !is_dir(dirname($p))) {
            throw new \RuntimeException('No se pudo crear el directorio de subidas');
        }
        file_put_contents($p, $body, LOCK_EX);
    }

    public function read(string $key, ?int $length = null): ?string
    {
        $p = $this->path($key);
        if (!is_file($p)) return null;
        $data = $length === null ? file_get_contents($p) : file_get_contents($p, false, null, 0, $length);
        return $data === false ? null : $data;
    }

    public function remove(string $key): void
    {
        $p = $this->path($key);
        if (is_file($p)) @unlink($p);
    }

    /** Validación mínima de cabeceras de imagen: evita que se "confirme" algo que no es imagen. */
    public static function sniffImage(string $b): ?string
    {
        if (strlen($b) >= 8 && str_starts_with($b, "\x89PNG")) return 'image/png';
        if (strlen($b) >= 3 && str_starts_with($b, "\xFF\xD8\xFF")) return 'image/jpeg';
        if (strlen($b) >= 12 && substr($b, 0, 4) === 'RIFF' && substr($b, 8, 4) === 'WEBP') return 'image/webp';
        $head = strtolower(trim(substr($b, 0, 256)));
        if (str_starts_with($head, '<svg') || (str_starts_with($head, '<?xml') && str_contains($head, '<svg'))) return 'image/svg+xml';
        return null;
    }
}
