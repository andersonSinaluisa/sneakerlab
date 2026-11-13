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
use SneakerLab\Pricing\Engine;
use SneakerLab\Validator as V;

/** /api/quotes: cotización instantánea (sin guardar) y cotización formal con vigencia. */
final class Quotes
{
    /** @return array{0:array<string,mixed>,1:array{services:list<string>,finish?:string}} */
    private static function input(Request $req): array
    {
        $body = V::object(Http::body($req), [
            'document' => V::any(),
            'designId' => V::optional(V::string()),
            'extras' => V::withDefault(V::shape([
                'services' => V::withDefault(V::arrayOf(V::string(max: 60), max: 10), []),
                'finish' => V::optional(V::string(max: 60)),
            ]), (object) ['services' => []]),
        ]);
        return [$body, (array) $body['extras']];
    }

    /** @return list<array<string,mixed>> */
    public static function loadRules(Db $db): array
    {
        return array_map(fn ($r) => ['kind' => $r['kind'], 'target' => $r['target'], 'label' => $r['label'], 'amount' => (float) $r['amount'], 'factor' => (float) $r['factor'], 'active' => (bool) $r['active']],
            $db->all('SELECT * FROM price_rules WHERE active = 1 ORDER BY created_at, id'));
    }

    /** @return array{0:\stdClass,1:array<string,mixed>} documento validado y desglose */
    public static function price(Ctx $ctx, mixed $document, array $extras): array
    {
        $doc = Contracts::parseDocument($document);
        try {
            return [$doc, Engine::compute($doc, Contracts::model($doc->modelId), self::loadRules($ctx->db()), $extras)];
        } catch (\DomainException $e) {
            throw new HttpError(503, $e->getMessage());
        }
    }

    public static function toQuote(array $q): array
    {
        return [
            'id' => $q['id'], 'designId' => $q['design_id'], 'modelId' => $q['model_id'], 'currency' => $q['currency'],
            'basePrice' => (float) $q['base_price'], 'customization' => (float) $q['customization'], 'extras' => (float) $q['extras'], 'total' => (float) $q['total'],
            'breakdown' => Http::decodeJson($q['breakdown']), 'documentHash' => $q['document_hash'], 'expiresAt' => Http::iso($q['expires_at']), 'createdAt' => Http::iso($q['created_at']),
        ];
    }

    public static function register(App $app, Ctx $ctx): void
    {
        /** Cotización instantánea sin guardar (la usa el panel de precio mientras se edita). No requiere sesión. */
        $app->post('/api/quotes/preview', function (Request $req, Response $res) use ($ctx) {
            [$body, $extras] = self::input($req);
            [, $breakdown] = self::price($ctx, $body['document'], $extras);
            return Http::json($res, ['quote' => $breakdown]);
        });

        /** Cotización formal con vigencia; es la que se referencia al crear un pedido. */
        $app->post('/api/quotes', function (Request $req, Response $res) use ($ctx) {
            [$body, $extras] = self::input($req);
            [$doc, $b] = self::price($ctx, $body['document'], $extras);
            $user = $req->getAttribute('user');
            $id = Http::uuid();
            $now = $ctx->now($req);
            $ctx->db()->insert('quotes', [
                'id' => $id, 'user_id' => $user['sub'] ?? null, 'design_id' => $body['designId'] ?? null, 'model_id' => $doc->modelId, 'currency' => $b['currency'],
                'base_price' => Http::money($b['basePrice']), 'customization' => Http::money($b['customization']), 'extras' => Http::money($b['extras']), 'total' => Http::money($b['total']),
                'breakdown' => Http::encodeJson($b + ['extrasInput' => (object) $extras]), 'document_hash' => Http::documentHash($doc),
                'expires_at' => Http::mysqlTime($now->modify("+{$ctx->config->quoteTtlHours} hours")), 'created_at' => Http::mysqlTime($now),
            ]);
            return Http::json($res, ['quote' => self::toQuote($ctx->db()->one('SELECT * FROM quotes WHERE id = ?', [$id]))], 201);
        });

        $app->get('/api/quotes/{id}', function (Request $req, Response $res, array $args) use ($ctx) {
            $row = $ctx->db()->one('SELECT * FROM quotes WHERE id = ?', [$args['id']]);
            $user = $req->getAttribute('user');
            if (!$row || ($row['user_id'] && $row['user_id'] !== ($user['sub'] ?? null) && ($user['role'] ?? null) !== 'admin')) throw new HttpError(404, 'Cotización no encontrada');
            return Http::json($res, ['quote' => self::toQuote($row)]);
        });
    }
}
