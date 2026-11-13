<?php
declare(strict_types=1);

namespace SneakerLab;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\App as SlimApp;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Slim\Factory\AppFactory;
use Slim\Psr7\Response as Psr7Response;

final class App
{
    public static function create(string $root): SlimApp
    {
        $ctx = new Ctx(Config::load($root));
        $app = AppFactory::create();

        $app->get('/api/health', fn (Request $req, Response $res) => Http::json($res, ['ok' => true, 'storage' => 'local', 'time' => Http::iso(Http::mysqlTime($ctx->now($req)))]));
        Routes\Account::register($app, $ctx);
        Routes\Catalog::register($app, $ctx);
        Routes\Assets::register($app, $ctx);
        Routes\Designs::register($app, $ctx);
        Routes\Quotes::register($app, $ctx);
        Routes\Orders::register($app, $ctx);
        Routes\Presets::register($app, $ctx);
        Routes\Categories::register($app, $ctx);
        Routes\Admin::register($app, $ctx);

        $app->addRoutingMiddleware();
        // Usuario autenticado (opcional en todas las rutas).
        $app->add(function (Request $req, Handler $h) use ($ctx): Response {
            // Con mod_rewrite la cabecera puede llegar solo como (REDIRECT_)HTTP_AUTHORIZATION.
            $auth = $req->getHeaderLine('Authorization')
                ?: (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
            if (str_starts_with($auth, 'Bearer ')) {
                $claims = Auth::verifyToken(substr($auth, 7), $ctx->config->jwtSecret);
                if ($claims) $req = $req->withAttribute('user', $claims);
            }
            return $h->handle($req);
        });
        $app->add(function (Request $req, Handler $h) use ($ctx): Response {
            try {
                return $h->handle($req);
            } catch (HttpError $e) {
                $body = ['error' => $e->getMessage()];
                if ($e->details !== null) $body['details'] = $e->details;
                return Http::json(new Psr7Response(), $body, $e->status);
            } catch (HttpNotFoundException) {
                return Http::json(new Psr7Response(), ['error' => 'Ruta no encontrada'], 404);
            } catch (HttpMethodNotAllowedException) {
                return Http::json(new Psr7Response(), ['error' => 'Método no permitido'], 405);
            } catch (\Throwable $e) {
                error_log('[sneakerlab] ' . $e);
                $body = ['error' => 'Error interno'];
                if (!$ctx->config->isTest() && $ctx->config->env !== 'production') $body['details'] = $e->getMessage();
                return Http::json(new Psr7Response(), $body, 500);
            }
        });
        // Cabeceras de seguridad y CORS (solo si el frontend vive en otro dominio).
        $app->add(function (Request $req, Handler $h) use ($ctx): Response {
            $origin = $req->getHeaderLine('Origin');
            $allowed = $origin !== '' && in_array($origin, $ctx->config->corsOrigins, true);
            $res = $req->getMethod() === 'OPTIONS' ? (new Psr7Response())->withStatus(204) : $h->handle($req);
            if ($allowed) {
                $res = $res->withHeader('Access-Control-Allow-Origin', $origin)
                    ->withHeader('Vary', 'Origin')
                    ->withHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
                    ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                    ->withHeader('Access-Control-Max-Age', '600');
            }
            return $res->withHeader('X-Content-Type-Options', 'nosniff')
                ->withHeader('X-Frame-Options', 'SAMEORIGIN')
                ->withHeader('Referrer-Policy', 'no-referrer')
                ->withHeader('Cache-Control', $res->hasHeader('Cache-Control') ? $res->getHeaderLine('Cache-Control') : 'no-store');
        });

        return $app;
    }
}
