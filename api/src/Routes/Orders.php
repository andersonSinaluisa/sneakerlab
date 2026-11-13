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

/** /api/orders: pedidos del cliente a partir de una cotización vigente. */
final class Orders
{
    public const STATUSES = ['pending', 'in_review', 'approved', 'in_production', 'finished', 'delivered', 'cancelled'];

    /** Transiciones permitidas. Cancelar es posible hasta que entra en producción. */
    public const TRANSITIONS = [
        'pending' => ['in_review', 'cancelled'],
        'in_review' => ['approved', 'pending', 'cancelled'],
        'approved' => ['in_production', 'cancelled'],
        'in_production' => ['finished'],
        'finished' => ['delivered'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public static function toOrder(array $o, ?array $history = null): array
    {
        $out = [
            'id' => $o['id'], 'number' => (int) $o['number'], 'userId' => $o['user_id'], 'designId' => $o['design_id'], 'quoteId' => $o['quote_id'], 'status' => $o['status'],
            'total' => (float) $o['total'], 'currency' => $o['currency'], 'size' => $o['size'], 'notes' => $o['notes'], 'shipping' => Http::decodeJson($o['shipping']),
            'priceSnapshot' => Http::decodeJson($o['price_snapshot']), 'createdAt' => Http::iso($o['created_at']), 'updatedAt' => Http::iso($o['updated_at']),
        ];
        if ($history !== null) $out['history'] = array_map(fn ($h) => ['from' => $h['from_status'], 'to' => $h['to_status'], 'note' => $h['note'], 'at' => Http::iso($h['created_at'])], $history);
        return $out;
    }

    public static function history(Ctx $ctx, string $orderId): array
    {
        return $ctx->db()->all('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at, seq', [$orderId]);
    }

    public static function changeStatus(Ctx $ctx, Request $req, array $order, string $to, ?string $byUserId, ?string $note = null): array
    {
        if (!in_array($to, self::TRANSITIONS[$order['status']], true)) throw new HttpError(409, "No se puede pasar de {$order['status']} a $to");
        $db = $ctx->db();
        $now = Http::mysqlTime($ctx->now($req));
        $db->transaction(function () use ($db, $order, $to, $byUserId, $note, $now) {
            $db->update('orders', ['status' => $to, 'updated_at' => $now], $order['id']);
            $db->insert('order_status_history', ['id' => Http::uuid(), 'order_id' => $order['id'], 'from_status' => $order['status'], 'to_status' => $to, 'by_user_id' => $byUserId, 'note' => $note, 'created_at' => $now]);
        });
        return $db->one('SELECT * FROM orders WHERE id = ?', [$order['id']]);
    }

    public static function register(App $app, Ctx $ctx): void
    {
        $app->get('/api/orders', function (Request $req, Response $res) use ($ctx) {
            $user = Http::requireUser($req);
            $rows = $ctx->db()->all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [$user['sub']]);
            return Http::json($res, ['orders' => array_map(fn ($o) => self::toOrder($o), $rows)]);
        });

        $app->post('/api/orders', function (Request $req, Response $res) use ($ctx) {
            $user = Http::requireUser($req);
            $body = V::object(Http::body($req), [
                'quoteId' => V::string(),
                'document' => V::any(),
                'designId' => V::optional(V::string()),
                'size' => V::string(min: 1, max: 20, trim: true),
                'notes' => V::optional(V::string(max: 1000, trim: true)),
                'shipping' => V::shape([
                    'fullName' => V::string(min: 1, max: 120, trim: true),
                    'phone' => V::optional(V::string(max: 40, trim: true)),
                    'address1' => V::string(min: 1, max: 200, trim: true),
                    'address2' => V::optional(V::string(max: 200, trim: true)),
                    'city' => V::string(min: 1, max: 100, trim: true),
                    'region' => V::optional(V::string(max: 100, trim: true)),
                    'postalCode' => V::optional(V::string(max: 20, trim: true)),
                    'country' => V::string(trim: true, length: 2),
                ]),
            ]);
            $db = $ctx->db();
            $quote = $db->one('SELECT * FROM quotes WHERE id = ?', [$body['quoteId']]);
            if (!$quote || ($quote['user_id'] && $quote['user_id'] !== $user['sub'])) throw HttpError::notFound('Cotización');
            $now = $ctx->now($req);
            if (new \DateTimeImmutable($quote['expires_at'], new \DateTimeZone('UTC')) < $now) throw new HttpError(409, 'La cotización ha caducado; vuelve a cotizar');
            $doc = Contracts::parseDocument($body['document']);
            if (!hash_equals($quote['document_hash'], Http::documentHash($doc))) throw new HttpError(409, 'El diseño cambió desde la cotización; vuelve a cotizar');

            $id = Http::uuid();
            $ts = Http::mysqlTime($now);
            $db->transaction(function () use ($db, $id, $user, $body, $quote, $doc, $ts) {
                $next = (int) $db->one('SELECT COALESCE(MAX(number), 1000) AS n FROM orders FOR UPDATE')['n'] + 1;
                $db->insert('orders', [
                    'id' => $id, 'number' => $next, 'user_id' => $user['sub'], 'design_id' => $body['designId'] ?? $quote['design_id'], 'quote_id' => $quote['id'],
                    'document_snapshot' => Http::encodeJson($doc), 'price_snapshot' => $quote['breakdown'], 'total' => Http::money((float) $quote['total']), 'currency' => $quote['currency'],
                    'size' => $body['size'], 'notes' => $body['notes'] ?? null, 'shipping' => Http::encodeJson($body['shipping']), 'created_at' => $ts, 'updated_at' => $ts,
                ]);
                $db->insert('order_status_history', ['id' => Http::uuid(), 'order_id' => $id, 'from_status' => null, 'to_status' => 'pending', 'by_user_id' => $user['sub'], 'note' => 'Pedido creado', 'created_at' => $ts]);
            });
            return Http::json($res, ['order' => self::toOrder($db->one('SELECT * FROM orders WHERE id = ?', [$id]))], 201);
        });

        $app->get('/api/orders/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            $user = Http::requireUser($req);
            $row = $user['role'] === 'admin'
                ? $ctx->db()->one('SELECT * FROM orders WHERE id = ?', [$args['id']])
                : $ctx->db()->one('SELECT * FROM orders WHERE id = ? AND user_id = ?', [$args['id'], $user['sub']]);
            if (!$row) throw HttpError::notFound('Pedido');
            return Http::json($res, ['order' => self::toOrder($row, self::history($ctx, $row['id'])) + ['documentSnapshot' => Http::decodeJson($row['document_snapshot'])]]);
        });

        $app->post('/api/orders/{id}/cancel', function (Request $req, Response $res, array $args) use ($ctx) {
            $user = Http::requireUser($req);
            $row = $ctx->db()->one('SELECT * FROM orders WHERE id = ? AND user_id = ?', [$args['id'], $user['sub']]);
            if (!$row) throw HttpError::notFound('Pedido');
            // Lo que puede hacer el cliente por su cuenta (sin ser admin).
            if (!in_array($row['status'], ['pending', 'in_review'], true)) throw new HttpError(409, 'El pedido ya no se puede cancelar; contacta con el taller');
            return Http::json($res, ['order' => self::toOrder(self::changeStatus($ctx, $req, $row, 'cancelled', $user['sub'], 'Cancelado por el cliente'))]);
        });
    }
}
