<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Ctx;
use SneakerLab\Http;
use SneakerLab\HttpError;
use SneakerLab\Storage;
use SneakerLab\Validator as V;

/**
 * Flujo de subida en dos pasos:
 *  1. POST /api/assets → registra metadatos y devuelve el destino de subida (PUT /uploads/<clave>).
 *  2. El cliente hace PUT al destino.
 *  3. POST /api/assets/:id/confirm → el servidor comprueba tamaño y cabecera de imagen.
 */
final class Assets
{
    private const EXT = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/svg+xml' => 'svg'];

    public static function register(App $app, Ctx $ctx): void
    {
        $app->post('/api/assets', function (Request $req, Response $res) use ($ctx) {
            $user = Http::requireUser($req);
            $body = V::object(Http::body($req), [
                'name' => V::string(min: 1, max: 160, trim: true),
                'mime' => V::enum(array_keys(self::EXT)),
                'bytes' => V::number(int: true, positive: true),
                'width' => V::number(int: true, positive: true, max: 8192),
                'height' => V::number(int: true, positive: true, max: 8192),
                'sha256' => V::optional(V::string(regex: '/^[a-f0-9]{64}$/')),
            ]);
            $max = $ctx->config->maxUploadBytes;
            if ($body['bytes'] > $max) throw new HttpError(413, 'La imagen supera el máximo de ' . round($max / 1024 / 1024) . ' MB');
            $id = Http::uuid();
            $key = "u/{$user['sub']}/$id." . self::EXT[$body['mime']];
            $db = $ctx->db();
            $db->insert('assets', ['id' => $id, 'owner_id' => $user['sub'], 'storage_key' => $key, 'mime' => $body['mime'], 'bytes' => $body['bytes'], 'width' => $body['width'], 'height' => $body['height'], 'sha256' => $body['sha256'] ?? null]);
            $asset = $db->one('SELECT * FROM assets WHERE id = ?', [$id]);
            return Http::json($res, ['asset' => self::toRef($asset, $ctx->storage->publicUrl($key)), 'upload' => ['method' => 'PUT', 'url' => self::absolute($req, $ctx->storage->publicUrl($key)), 'headers' => new \stdClass()]], 201);
        });

        $app->post('/api/assets/{id}/confirm', function (Request $req, Response $res, array $args) use ($ctx) {
            $user = Http::requireUser($req);
            $db = $ctx->db();
            $asset = $db->one('SELECT * FROM assets WHERE id = ?', [$args['id']]);
            if (!$asset || $asset['owner_id'] !== $user['sub']) throw HttpError::notFound();
            $size = $ctx->storage->size($asset['storage_key']);
            if ($size === null) throw new HttpError(409, 'La subida no se completó');
            if ($size !== (int) $asset['bytes']) throw new HttpError(409, 'El tamaño subido no coincide con el declarado');
            $head = $ctx->storage->read($asset['storage_key'], 512);
            if (($head === null ? null : Storage::sniffImage($head)) !== $asset['mime']) {
                $ctx->storage->remove($asset['storage_key']);
                $db->run('DELETE FROM assets WHERE id = ?', [$asset['id']]);
                throw new HttpError(415, 'El archivo no es una imagen válida del tipo declarado');
            }
            $db->run('UPDATE assets SET confirmed = 1, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [$asset['id']]);
            $asset = $db->one('SELECT * FROM assets WHERE id = ?', [$asset['id']]);
            return Http::json($res, ['asset' => self::toRef($asset, $ctx->storage->publicUrl($asset['storage_key']))]);
        });

        $app->get('/api/assets/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            $asset = $ctx->db()->one('SELECT * FROM assets WHERE id = ?', [$args['id']]);
            if (!$asset || !$asset['confirmed']) throw HttpError::notFound();
            return Http::json($res, ['asset' => self::toRef($asset, $ctx->storage->publicUrl($asset['storage_key']))]);
        });

        /** Recibe el binario de una subida registrada y aún no confirmada. */
        $app->put('/uploads/{key:.+}', function (Request $req, Response $res, array $args) use ($ctx) {
            $key = Storage::safeKey($args['key']);
            $asset = $ctx->db()->one('SELECT * FROM assets WHERE storage_key = ?', [$key]);
            if (!$asset) throw HttpError::notFound();
            if ($asset['confirmed']) throw new HttpError(409, 'El recurso ya fue confirmado');
            $body = (string) $req->getBody();
            if (strlen($body) > $ctx->config->maxUploadBytes) throw new HttpError(413, 'Archivo demasiado grande');
            $ctx->storage->write($key, $body);
            return Http::noContent($res);
        });

        $app->get('/uploads/{key:.+}', function (Request $req, Response $res, array $args) use ($ctx) {
            $data = $ctx->storage->read(Storage::safeKey($args['key']));
            if ($data === null) throw HttpError::notFound('Archivo');
            $mime = Storage::sniffImage(substr($data, 0, 512)) ?? 'application/octet-stream';
            $res->getBody()->write($data);
            return $res->withHeader('Content-Type', $mime)
                ->withHeader('Cache-Control', 'public, max-age=31536000, immutable')
                // Un SVG abierto directamente no puede ejecutar scripts en este origen.
                ->withHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox");
        });
    }

    /** URL absoluta del mismo origen (el cliente hace `new URL(upload.url)`). */
    private static function absolute(Request $req, string $path): string
    {
        $uri = $req->getUri();
        $port = $uri->getPort();
        return $uri->getScheme() . '://' . $uri->getHost() . ($port ? ":$port" : '') . $path;
    }

    private static function toRef(array $a, string $url): array
    {
        $parts = explode('/', $a['storage_key']);
        return ['id' => $a['id'], 'name' => end($parts) ?: $a['id'], 'mime' => $a['mime'], 'width' => (int) $a['width'], 'height' => (int) $a['height'], 'bytes' => (int) $a['bytes'], 'createdAt' => Http::iso($a['created_at']), 'url' => $url, 'confirmed' => (bool) $a['confirmed']];
    }
}
