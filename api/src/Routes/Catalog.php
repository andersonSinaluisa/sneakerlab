<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Contracts;
use SneakerLab\Ctx;
use SneakerLab\Http;

/** Catálogo de solo lectura. Modelos, materiales y categorías salen de api/contracts/catalog.json. */
final class Catalog
{
    public static function register(App $app, Ctx $ctx): void
    {
        $app->get('/api/catalog/models', function (Request $req, Response $res) {
            $models = array_map(fn ($m) => [
                'modelId' => $m['modelId'], 'name' => $m['name'], 'version' => $m['version'], 'provisional' => $m['provisional'] ?? null,
                'zones' => array_map(fn ($z) => array_filter([
                    'id' => $z['id'], 'label' => $z['label'], 'material' => $z['material'], 'materialOptions' => $z['materialOptions'] ?? null,
                    'allowImages' => $z['allowImages'], 'allowText' => $z['allowText'],
                ], fn ($v) => $v !== null), $m['zones']),
            ], Contracts::catalog()['models']);
            return Http::json($res, ['models' => $models]);
        });

        $app->get('/api/catalog/materials', fn (Request $req, Response $res) => Http::json($res, ['materials' => Contracts::catalog()['materials']]));

        $app->get('/api/catalog/categories', fn (Request $req, Response $res) => Http::json($res, ['categories' => Contracts::catalog()['categories'], 'groups' => Contracts::catalog()['groups']]));

        /** Extras elegibles al pedir (acabados y servicios) con su precio vigente. */
        $app->get('/api/catalog/extras', function (Request $req, Response $res) use ($ctx) {
            $rows = $ctx->db()->all("SELECT kind, target, label, amount FROM price_rules WHERE active = 1 AND kind IN ('finish','service') AND target IS NOT NULL ORDER BY created_at");
            $map = fn (string $k) => array_values(array_map(fn ($r) => ['code' => $r['target'], 'label' => $r['label'], 'amount' => (float) $r['amount']], array_filter($rows, fn ($r) => $r['kind'] === $k)));
            return Http::json($res, ['finishes' => $map('finish'), 'services' => $map('service')]);
        });
    }
}
