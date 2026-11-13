<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Ctx;
use SneakerLab\Http;
use SneakerLab\HttpError;
use SneakerLab\Validator as V;

/** /api/admin: estadísticas, reglas de precio, pedidos y presets. Todas requieren rol admin. */
final class Admin
{
    public const RULE_KINDS = ['base_model', 'per_zone', 'per_image', 'per_text', 'per_pattern', 'material_factor', 'finish', 'service', 'complexity'];

    private static function ruleShape(): array
    {
        return [
            'kind' => V::enum(self::RULE_KINDS),
            'target' => V::withDefault(V::nullable(V::string(max: 60, trim: true)), null),
            'label' => V::string(min: 1, max: 120, trim: true),
            'amount' => V::withDefault(V::number(min: 0, max: 100000), 0),
            'factor' => V::withDefault(V::number(min: 0, max: 100), 1),
            'active' => V::withDefault(V::bool(), true),
        ];
    }

    private static function toRule(array $r): array
    {
        return ['id' => $r['id'], 'kind' => $r['kind'], 'target' => $r['target'], 'label' => $r['label'], 'amount' => (float) $r['amount'], 'factor' => (float) $r['factor'], 'active' => (bool) $r['active'], 'updatedAt' => Http::iso($r['updated_at'])];
    }

    public static function register(App $app, Ctx $ctx): void
    {
        Presets::registerAdmin($app, $ctx);

        $app->get('/api/admin/stats', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $db = $ctx->db();
            $byStatus = $db->all('SELECT status, COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM orders GROUP BY status');
            return Http::json($res, [
                'users' => (int) $db->one('SELECT COUNT(*) AS n FROM users')['n'],
                'designs' => (int) $db->one('SELECT COUNT(*) AS n FROM designs')['n'],
                'orders' => array_map(fn ($r) => ['status' => $r['status'], 'count' => (int) $r['n'], 'total' => (float) $r['total']], $byStatus),
            ]);
        });

        $app->get('/api/admin/price-rules', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $rows = $ctx->db()->all('SELECT * FROM price_rules ORDER BY FIELD(kind, ' . implode(',', array_map(fn ($k) => "'$k'", self::RULE_KINDS)) . '), target IS NULL, target');
            return Http::json($res, ['rules' => array_map([self::class, 'toRule'], $rows)]);
        });

        $app->post('/api/admin/price-rules', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $b = V::object(Http::body($req), self::ruleShape());
            $id = Http::uuid();
            $ctx->db()->insert('price_rules', ['id' => $id, 'kind' => $b['kind'], 'target' => $b['target'], 'label' => $b['label'], 'amount' => Http::money((float) $b['amount']), 'factor' => number_format((float) $b['factor'], 3, '.', ''), 'active' => $b['active']]);
            return Http::json($res, ['rule' => self::toRule($ctx->db()->one('SELECT * FROM price_rules WHERE id = ?', [$id]))], 201);
        });

        $app->put('/api/admin/price-rules/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            $b = V::object(Http::body($req), V::partial(self::ruleShape()));
            $db = $ctx->db();
            if (!$db->one('SELECT id FROM price_rules WHERE id = ?', [$args['id']])) throw HttpError::notFound('Regla');
            $patch = ['updated_at' => Http::mysqlTime($ctx->now($req))];
            foreach (['kind', 'target', 'label', 'active'] as $k) if (array_key_exists($k, $b)) $patch[$k] = $b[$k];
            if (isset($b['amount'])) $patch['amount'] = Http::money((float) $b['amount']);
            if (isset($b['factor'])) $patch['factor'] = number_format((float) $b['factor'], 3, '.', '');
            $db->update('price_rules', $patch, $args['id']);
            return Http::json($res, ['rule' => self::toRule($db->one('SELECT * FROM price_rules WHERE id = ?', [$args['id']]))]);
        });

        $app->delete('/api/admin/price-rules/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            if (!$ctx->db()->run('DELETE FROM price_rules WHERE id = ?', [$args['id']])->rowCount()) throw HttpError::notFound('Regla');
            return Http::noContent($res);
        });

        $app->get('/api/admin/orders', function (Request $req, Response $res) use ($ctx) {
            Http::requireAdmin($req);
            $status = $req->getQueryParams()['status'] ?? null;
            $sql = 'SELECT o.*, u.email AS customer_email, u.name AS customer_name FROM orders o JOIN users u ON u.id = o.user_id';
            $rows = $status ? $ctx->db()->all("$sql WHERE o.status = ? ORDER BY o.created_at DESC LIMIT 500", [$status]) : $ctx->db()->all("$sql ORDER BY o.created_at DESC LIMIT 500");
            return Http::json($res, ['orders' => array_map(fn ($r) => Orders::toOrder($r) + ['customer' => ['email' => $r['customer_email'], 'name' => $r['customer_name']]], $rows)]);
        });

        $app->get('/api/admin/orders/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            Http::requireAdmin($req);
            $row = $ctx->db()->one('SELECT * FROM orders WHERE id = ?', [$args['id']]);
            if (!$row) throw HttpError::notFound('Pedido');
            $customer = $ctx->db()->one('SELECT email, name FROM users WHERE id = ?', [$row['user_id']]);
            return Http::json($res, ['order' => Orders::toOrder($row, Orders::history($ctx, $row['id'])) + ['documentSnapshot' => Http::decodeJson($row['document_snapshot']), 'customer' => $customer ?: null]]);
        });

        $app->post('/api/admin/orders/{id}/status', function (Request $req, Response $res, array $args) use ($ctx) {
            $admin = Http::requireAdmin($req);
            $b = V::object(Http::body($req), ['status' => V::enum(Orders::STATUSES), 'note' => V::optional(V::string(max: 500, trim: true))]);
            $row = $ctx->db()->one('SELECT * FROM orders WHERE id = ?', [$args['id']]);
            if (!$row) throw HttpError::notFound('Pedido');
            return Http::json($res, ['order' => Orders::toOrder(Orders::changeStatus($ctx, $req, $row, $b['status'], $admin['sub'], $b['note'] ?? null))]);
        });
    }
}
