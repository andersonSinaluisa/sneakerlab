<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Contracts;
use SneakerLab\Ctx;
use SneakerLab\Http;
use SneakerLab\HttpError;
use SneakerLab\Validator as V;

/** /api/designs: diseños guardados en la nube por cada usuario, y enlaces públicos para compartir. */
final class Designs
{
    public static function register(App $app, Ctx $ctx): void
    {
        $saveShape = fn () => [
            'name' => V::optional(V::string(min: 1, max: 120, trim: true)),
            'document' => V::any(),
            'thumbnailUrl' => V::optional(V::string(max: 2000)),
        ];
        $own = function (Request $req, string $id) use ($ctx): array {
            $user = Http::requireUser($req);
            $row = $ctx->db()->one('SELECT * FROM designs WHERE id = ? AND owner_id = ?', [$id, $user['sub']]);
            if (!$row) throw HttpError::notFound('Diseño');
            return $row;
        };
        $load = fn (string $id) => $ctx->db()->one('SELECT * FROM designs WHERE id = ?', [$id]);

        $app->get('/api/designs', function (Request $req, Response $res) use ($ctx) {
            $user = Http::requireUser($req);
            $rows = $ctx->db()->all('SELECT * FROM designs WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200', [$user['sub']]);
            return Http::json($res, ['designs' => array_map([self::class, 'summary'], $rows)]);
        });

        $app->post('/api/designs', function (Request $req, Response $res) use ($ctx, $saveShape, $load) {
            $user = Http::requireUser($req);
            $body = V::object(Http::body($req), $saveShape());
            $doc = Contracts::parseDocument($body['document']);
            $id = Http::uuid();
            $doc->id = $id;
            $doc->name = $body['name'] ?? $doc->name;
            $ctx->db()->insert('designs', ['id' => $id, 'owner_id' => $user['sub'], 'name' => $doc->name, 'model_id' => $doc->modelId, 'document' => Http::encodeJson($doc), 'thumbnail_url' => $body['thumbnailUrl'] ?? null]);
            return Http::json($res, ['design' => self::full($load($id))], 201);
        });

        $app->get('/api/designs/shared/{token}', function (Request $req, Response $res, array $args) use ($ctx) {
            $row = $ctx->db()->one('SELECT * FROM designs WHERE share_token = ?', [$args['token']]);
            if (!$row || !$row['is_public']) throw HttpError::notFound('Diseño compartido');
            $design = self::full($row);
            unset($design['shareToken']);
            return Http::json($res, ['design' => $design]);
        });

        $app->get('/api/designs/{id}', fn (Request $req, Response $res, array $args) => Http::json($res, ['design' => self::full($own($req, $args['id']))]));

        $app->put('/api/designs/{id}', function (Request $req, Response $res, array $args) use ($ctx, $saveShape, $own, $load) {
            $body = V::object(Http::body($req), $saveShape());
            $existing = $own($req, $args['id']);
            $doc = Contracts::parseDocument($body['document']);
            $doc->id = $existing['id'];
            $doc->name = $body['name'] ?? $doc->name;
            $doc->updatedAt = Http::iso(Http::mysqlTime($ctx->now($req)));
            $ctx->db()->update('designs', ['name' => $doc->name, 'model_id' => $doc->modelId, 'document' => Http::encodeJson($doc), 'thumbnail_url' => $body['thumbnailUrl'] ?? $existing['thumbnail_url'], 'updated_at' => Http::mysqlTime($ctx->now($req))], $existing['id']);
            return Http::json($res, ['design' => self::full($load($existing['id']))]);
        });

        $app->delete('/api/designs/{id}', function (Request $req, Response $res, array $args) use ($ctx, $own) {
            $row = $own($req, $args['id']);
            $ctx->db()->run('DELETE FROM designs WHERE id = ?', [$row['id']]);
            return Http::noContent($res);
        });

        $app->post('/api/designs/{id}/duplicate', function (Request $req, Response $res, array $args) use ($ctx, $own, $load) {
            $src = $own($req, $args['id']);
            $id = Http::uuid();
            $now = Http::iso(Http::mysqlTime($ctx->now($req)));
            $name = "{$src['name']} (copia)";
            $doc = Http::decodeJson($src['document']);
            $doc->id = $id;
            $doc->name = $name;
            $doc->createdAt = $now;
            $doc->updatedAt = $now;
            $ctx->db()->insert('designs', ['id' => $id, 'owner_id' => $src['owner_id'], 'name' => $name, 'model_id' => $src['model_id'], 'document' => Http::encodeJson($doc), 'thumbnail_url' => $src['thumbnail_url']]);
            return Http::json($res, ['design' => self::full($load($id))], 201);
        });

        $app->post('/api/designs/{id}/share', function (Request $req, Response $res, array $args) use ($ctx, $own, $load) {
            $body = V::object(Http::body($req), ['enabled' => V::bool()]);
            $src = $own($req, $args['id']);
            $token = $body['enabled'] ? ($src['share_token'] ?? rtrim(strtr(base64_encode(random_bytes(12)), '+/', '-_'), '=')) : $src['share_token'];
            $ctx->db()->update('designs', ['is_public' => $body['enabled'], 'share_token' => $token, 'updated_at' => Http::mysqlTime($ctx->now($req))], $src['id']);
            return Http::json($res, ['design' => self::summary($load($src['id']))]);
        });
    }

    public static function summary(array $d): array
    {
        return ['id' => $d['id'], 'name' => $d['name'], 'modelId' => $d['model_id'], 'thumbnailUrl' => $d['thumbnail_url'], 'isPublic' => (bool) $d['is_public'], 'shareToken' => $d['share_token'], 'createdAt' => Http::iso($d['created_at']), 'updatedAt' => Http::iso($d['updated_at'])];
    }

    private static function full(array $d): array
    {
        return self::summary($d) + ['document' => Http::decodeJson($d['document'])];
    }
}
