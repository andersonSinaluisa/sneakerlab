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

/**
 * Presets del servidor. Los integrados viven en el código del frontend (catalog.ts); aquí se guardan
 * los creados por administración desde el editor y se publican al catálogo.
 */
final class Presets
{
    public static function toPreset(array $r): array
    {
        $p = (array) Http::decodeJson($r['preset']);
        $p['id'] = $r['id'];
        $p['status'] = $r['status'];
        if ($r['badge'] !== null) $p['badge'] = $r['badge']; else unset($p['badge']);
        $p['source'] = 'custom';
        $p['createdAt'] = Http::iso($r['created_at']);
        $p['updatedAt'] = Http::iso($r['updated_at']);
        return $p;
    }

    /** Valida el cuerpo con el contrato del frontend y aplica los valores por defecto de zod. */
    private static function body(Request $req): \stdClass
    {
        $b = Http::body($req);
        $errors = Contracts::validate('preset-body', $b);
        if ($errors) throw new HttpError(422, 'Datos inválidos', $errors);
        foreach (['tags' => [], 'previewImages' => [], 'zones' => [], 'layers' => [], 'assets' => [], 'status' => 'draft', 'pendingAssets' => [], 'version' => 1] as $k => $v) {
            if (!property_exists($b, $k)) $b->$k = $v;
        }
        $layerDefaults = ['kind' => 'image', 'shoe' => 'both', 'x' => 0.5, 'y' => 0.5, 'width' => 0.4, 'rotation' => 0, 'opacity' => 1, 'flipX' => false, 'mirrorOnLeft' => false];
        foreach ($b->layers as $l) foreach ($layerDefaults as $k => $v) if (!property_exists($l, $k)) $l->$k = $v;
        foreach ($b->assets as $a) foreach (['rasterSize' => 1024, 'license' => 'original'] as $k => $v) if (!property_exists($a, $k)) $a->$k = $v;
        return $b;
    }

    private static function load(Ctx $ctx, string $id): ?array
    {
        return $ctx->db()->one('SELECT * FROM design_presets WHERE id = ?', [$id]);
    }

    public static function register(App $app, Ctx $ctx): void
    {
        $app->get('/api/presets', function (Request $req, Response $res) use ($ctx) {
            $rows = $ctx->db()->all("SELECT * FROM design_presets WHERE status = 'published' ORDER BY published_at DESC");
            return Http::json($res, ['presets' => array_map([self::class, 'toPreset'], $rows)]);
        });

        $app->get('/api/presets/favorites', function (Request $req, Response $res) use ($ctx) {
            $user = Http::requireUser($req);
            $rows = $ctx->db()->all('SELECT preset_id FROM user_favorites WHERE user_id = ? ORDER BY created_at', [$user['sub']]);
            return Http::json($res, ['favorites' => array_column($rows, 'preset_id')]);
        });

        $app->put('/api/presets/favorites/{presetId}', function (Request $req, Response $res, array $args) use ($ctx) {
            $user = Http::requireUser($req);
            $ctx->db()->run('INSERT IGNORE INTO user_favorites (user_id, preset_id) VALUES (?, ?)', [$user['sub'], substr($args['presetId'], 0, 120)]);
            return Http::noContent($res);
        });

        $app->delete('/api/presets/favorites/{presetId}', function (Request $req, Response $res, array $args) use ($ctx) {
            $user = Http::requireUser($req);
            $ctx->db()->run('DELETE FROM user_favorites WHERE user_id = ? AND preset_id = ?', [$user['sub'], $args['presetId']]);
            return Http::noContent($res);
        });

        $app->get('/api/presets/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            $row = self::load($ctx, $args['id']);
            if (!$row || ($row['status'] !== 'published' && ($req->getAttribute('user')['role'] ?? null) !== 'admin')) throw HttpError::notFound('Diseño');
            return Http::json($res, ['preset' => self::toPreset($row)]);
        });
    }

    /** Rutas bajo /api/admin/presets (Admin comprueba el rol). */
    public static function registerAdmin(App $app, Ctx $ctx): void
    {
        $app->get('/api/admin/presets', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $rows = $ctx->db()->all('SELECT * FROM design_presets ORDER BY updated_at DESC');
            return Http::json($res, ['presets' => array_map([self::class, 'toPreset'], $rows)]);
        });

        $app->post('/api/admin/presets', function (Request $req, Response $res) use ($ctx) {
            $admin = Http::requireAdmin($req);
            $b = self::body($req);
            $id = $b->id ?? 'custom-' . substr(Http::uuid(), 0, 8);
            if (self::load($ctx, $id)) throw new HttpError(409, 'Ya existe un diseño con ese id');
            $status = count($b->pendingAssets) ? 'pending-assets' : $b->status;
            $b->id = $id;
            $b->source = 'custom';
            $now = Http::mysqlTime($ctx->now($req));
            $ctx->db()->insert('design_presets', ['id' => $id, 'author_id' => $admin['sub'], 'name' => $b->name, 'category' => $b->category, 'status' => $status, 'badge' => $b->badge ?? null, 'preset' => Http::encodeJson($b), 'published_at' => $status === 'published' ? $now : null, 'created_at' => $now, 'updated_at' => $now]);
            return Http::json($res, ['preset' => self::toPreset(self::load($ctx, $id))], 201);
        });

        $app->put('/api/admin/presets/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            $b = self::body($req);
            $existing = self::load($ctx, $args['id']);
            if (!$existing) throw HttpError::notFound('Diseño');
            $status = count($b->pendingAssets) ? 'pending-assets' : $b->status;
            $prev = Http::decodeJson($existing['preset']);
            $b->id = $existing['id'];
            $b->source = 'custom';
            $b->version = ($prev->version ?? 1) + 1;
            $now = Http::mysqlTime($ctx->now($req));
            $ctx->db()->update('design_presets', ['name' => $b->name, 'category' => $b->category, 'status' => $status, 'badge' => $b->badge ?? null, 'preset' => Http::encodeJson($b), 'published_at' => $status === 'published' ? ($existing['published_at'] ?? $now) : $existing['published_at'], 'updated_at' => $now], $existing['id']);
            return Http::json($res, ['preset' => self::toPreset(self::load($ctx, $existing['id']))]);
        });

        $app->post('/api/admin/presets/{id}/publish', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            ['published' => $published] = V::object(Http::body($req), ['published' => V::bool()]);
            $existing = self::load($ctx, $args['id']);
            if (!$existing) throw HttpError::notFound('Diseño');
            $preset = Http::decodeJson($existing['preset']);
            if ($published && count($preset->pendingAssets ?? []) > 0) throw new HttpError(409, 'No se puede publicar: faltan ilustraciones');
            $status = $published ? 'published' : 'draft';
            $preset->status = $status;
            $now = Http::mysqlTime($ctx->now($req));
            $ctx->db()->update('design_presets', ['status' => $status, 'preset' => Http::encodeJson($preset), 'published_at' => $published ? $now : $existing['published_at'], 'updated_at' => $now], $existing['id']);
            return Http::json($res, ['preset' => self::toPreset(self::load($ctx, $existing['id']))]);
        });

        $app->delete('/api/admin/presets/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            if (!$ctx->db()->run('DELETE FROM design_presets WHERE id = ?', [$args['id']])->rowCount()) throw HttpError::notFound('Diseño');
            return Http::noContent($res);
        });
    }
}
