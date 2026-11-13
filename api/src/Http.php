<?php
declare(strict_types=1);

namespace SneakerLab;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

final class Http
{
    public const JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;

    public static function json(Response $res, mixed $data, int $status = 200): Response
    {
        $res->getBody()->write(json_encode($data, self::JSON_FLAGS));
        return $res->withStatus($status)->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function noContent(Response $res): Response
    {
        return $res->withStatus(204);
    }

    /**
     * Cuerpo JSON como objetos (stdClass): así `{}` y `[]` se conservan tal cual al guardar y devolver
     * documentos de diseño.
     */
    public static function body(Request $req): \stdClass
    {
        $raw = (string) $req->getBody();
        if ($raw === '') return new \stdClass();
        try {
            $data = json_decode($raw, false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpError(400, 'JSON inválido');
        }
        if (!$data instanceof \stdClass) throw new HttpError(422, 'Datos inválidos', ['(raíz): se esperaba un objeto']);
        return $data;
    }

    /** @return array{sub:string,role:string,email:string} */
    public static function requireUser(Request $req): array
    {
        $u = $req->getAttribute('user');
        if (!$u) throw new HttpError(401, 'Inicia sesión para continuar');
        return $u;
    }

    /** @return array{sub:string,role:string,email:string} */
    public static function requireAdmin(Request $req): array
    {
        $u = self::requireUser($req);
        if ($u['role'] !== 'admin') throw new HttpError(403, 'Solo administración');
        return $u;
    }

    public static function uuid(): string
    {
        $b = random_bytes(16);
        $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
        $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
    }

    /** Fecha UTC de MySQL (Y-m-d H:i:s[.v]) → ISO 8601 como Date.toJSON() en JS. */
    public static function iso(?string $mysql): ?string
    {
        if ($mysql === null) return null;
        $d = new \DateTimeImmutable($mysql, new \DateTimeZone('UTC'));
        return $d->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function mysqlTime(\DateTimeImmutable $d): string
    {
        return $d->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s.v');
    }

    /** Hash estable del documento (claves ordenadas) para comparar cotización y pedido. */
    public static function documentHash(mixed $doc): string
    {
        return hash('sha256', self::stable($doc));
    }

    private static function stable(mixed $v): string
    {
        if (is_array($v) && array_is_list($v)) return '[' . implode(',', array_map([self::class, 'stable'], $v)) . ']';
        if ($v instanceof \stdClass || is_array($v)) {
            $a = (array) $v;
            ksort($a, SORT_STRING);
            $parts = [];
            foreach ($a as $k => $val) $parts[] = json_encode((string) $k, self::JSON_FLAGS) . ':' . self::stable($val);
            return '{' . implode(',', $parts) . '}';
        }
        return json_encode($v, self::JSON_FLAGS);
    }

    public static function decodeJson(?string $s): mixed
    {
        return $s === null ? null : json_decode($s, false, 512, JSON_THROW_ON_ERROR);
    }

    public static function encodeJson(mixed $v): string
    {
        return json_encode($v, self::JSON_FLAGS);
    }

    public static function money(float $n): string
    {
        return number_format($n, 2, '.', '');
    }
}
