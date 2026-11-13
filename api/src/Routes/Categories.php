<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Contracts;
use SneakerLab\Ctx;
use SneakerLab\Db;
use SneakerLab\Http;
use SneakerLab\HttpError;
use SneakerLab\Validator as V;

/**
 * Estilos (categorías) de las plantillas. Los integrados se siembran desde catalog.json; desde
 * administración se crean nuevos, se renombran, se cambian de grupo y se ocultan o muestran.
 * Los integrados no se borran (los usan diseños del código): se ocultan.
 */
final class Categories
{
    /** @return array<string,string> */
    public static function groups(): array
    {
        return (array) Contracts::catalog()['groups'];
    }

    public static function toCategory(array $r): array
    {
        return ['id' => $r['id'], 'label' => $r['label'], 'group' => $r['group_id'], 'sort' => (int) $r['sort'], 'active' => (bool) $r['active'], 'builtin' => (bool) $r['builtin']];
    }

    public static function exists(Db $db, string $id): bool
    {
        return (bool) $db->one('SELECT id FROM design_categories WHERE id = ?', [$id]);
    }

    /** Inserta los integrados que falten (idempotente; no toca los ya existentes). */
    public static function seed(Db $db): int
    {
        $n = 0;
        foreach (array_values((array) Contracts::catalog()['categories']) as $i => $c) {
            $c = (array) $c;
            $n += $db->run('INSERT IGNORE INTO design_categories (id, label, group_id, sort, active, builtin) VALUES (?, ?, ?, ?, 1, 1)', [$c['id'], $c['label'], $c['group'], ($i + 1) * 10])->rowCount();
        }
        return $n;
    }

    public static function slug(string $s): string
    {
        $s = strtr(mb_strtolower(trim($s)), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n', 'à' => 'a', 'è' => 'e', 'ç' => 'c']);
        return substr(trim((string) preg_replace('/[^a-z0-9]+/', '-', $s), '-'), 0, 60);
    }

    private static function shape(): array
    {
        return [
            'label' => V::string(min: 1, max: 60, trim: true),
            'group' => V::enum(array_keys(self::groups())),
            'sort' => V::optional(V::number(min: 0, max: 100000, int: true)),
            'active' => V::optional(V::bool()),
        ];
    }

    private static function one(Db $db, string $id): array
    {
        return self::toCategory($db->one('SELECT * FROM design_categories WHERE id = ?', [$id]));
    }

    public static function register(App $app, Ctx $ctx): void
    {
        $app->get('/api/catalog/categories', function (Request $req, Response $res) use ($ctx) {
            $rows = $ctx->db()->all('SELECT * FROM design_categories WHERE active = 1 ORDER BY sort, label');
            return Http::json($res, ['categories' => array_map([self::class, 'toCategory'], $rows), 'groups' => self::groups()]);
        });

        $app->get('/api/admin/categories', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $rows = $ctx->db()->all('SELECT * FROM design_categories ORDER BY sort, label');
            return Http::json($res, ['categories' => array_map([self::class, 'toCategory'], $rows), 'groups' => self::groups()]);
        });

        $app->post('/api/admin/categories', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $b = V::object(Http::body($req), self::shape() + ['id' => V::optional(V::string(min: 2, max: 60, regex: '/^[a-z0-9-]+$/'))]);
            $id = $b['id'] ?? self::slug($b['label']);
            if (strlen($id) < 2) throw new HttpError(422, 'El nombre necesita al menos dos letras o números');
            $db = $ctx->db();
            if (self::exists($db, $id)) throw new HttpError(409, 'Ya existe un estilo con ese nombre');
            $sort = $b['sort'] ?? ((int) $db->one('SELECT COALESCE(MAX(sort), 0) AS m FROM design_categories')['m'] + 10);
            $db->insert('design_categories', ['id' => $id, 'label' => $b['label'], 'group_id' => $b['group'], 'sort' => $sort, 'active' => ($b['active'] ?? true) ? 1 : 0, 'builtin' => 0]);
            return Http::json($res, ['category' => self::one($db, $id)], 201);
        });

        $app->put('/api/admin/categories/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            $b = V::object(Http::body($req), V::partial(self::shape()));
            $db = $ctx->db();
            if (!self::exists($db, $args['id'])) throw HttpError::notFound('Estilo');
            $values = [];
            if (isset($b['label'])) $values['label'] = $b['label'];
            if (isset($b['group'])) $values['group_id'] = $b['group'];
            if (isset($b['sort'])) $values['sort'] = $b['sort'];
            if (isset($b['active'])) $values['active'] = $b['active'] ? 1 : 0;
            if ($values) $db->update('design_categories', $values + ['updated_at' => Http::mysqlTime($ctx->now($req))], $args['id']);
            return Http::json($res, ['category' => self::one($db, $args['id'])]);
        });

        $app->delete('/api/admin/categories/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            $db = $ctx->db();
            $row = $db->one('SELECT * FROM design_categories WHERE id = ?', [$args['id']]);
            if (!$row) throw HttpError::notFound('Estilo');
            if ($row['builtin']) throw new HttpError(409, 'Los estilos integrados no se eliminan: ocúltalo si no quieres mostrarlo');
            $n = (int) $db->one('SELECT COUNT(*) AS n FROM design_presets WHERE category = ?', [$args['id']])['n'];
            if ($n) throw new HttpError(409, "No se puede eliminar: lo usan $n diseño(s). Cámbialos de estilo u oculta este.");
            $db->run('DELETE FROM design_categories WHERE id = ?', [$args['id']]);
            return Http::noContent($res);
        });
    }
}
