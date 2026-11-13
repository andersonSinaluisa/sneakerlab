<?php
declare(strict_types=1);

namespace SneakerLab\Routes;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use SneakerLab\Auth;
use SneakerLab\Ctx;
use SneakerLab\Http;
use SneakerLab\HttpError;
use SneakerLab\Validator as V;

/** /api/auth: registro, inicio de sesión y usuario actual. */
final class Account
{
    public static function register(App $app, Ctx $ctx): void
    {
        $app->post('/api/auth/register', function (Request $req, Response $res) use ($ctx) {
            $body = V::object(Http::body($req), [
                'email' => V::email(),
                'password' => V::string(min: 8, max: 200),
                'name' => V::string(min: 1, max: 120, trim: true),
            ]);
            $db = $ctx->db();
            if ($db->one('SELECT id FROM users WHERE email = ?', [$body['email']])) throw new HttpError(409, 'Ya existe una cuenta con ese correo');
            // El primer usuario del sistema es admin si no hay ADMIN_EMAIL configurado.
            $first = !$db->one('SELECT id FROM users LIMIT 1');
            $user = ['id' => Http::uuid(), 'email' => $body['email'], 'name' => $body['name'], 'password_hash' => Auth::hashPassword($body['password']), 'role' => $first && !$ctx->config->adminEmail ? 'admin' : 'customer'];
            $db->insert('users', $user);
            $user = $db->one('SELECT * FROM users WHERE id = ?', [$user['id']]);
            return Http::json($res, ['user' => Auth::publicUser($user), 'token' => Auth::signToken($user, $ctx->config->jwtSecret)], 201);
        });

        $app->post('/api/auth/login', function (Request $req, Response $res) use ($ctx) {
            $body = V::object(Http::body($req), ['email' => V::email(), 'password' => V::string(min: 1, max: 200)]);
            $user = $ctx->db()->one('SELECT * FROM users WHERE email = ?', [$body['email']]);
            if (!$user || !Auth::verifyPassword($body['password'], $user['password_hash'])) throw new HttpError(401, 'Correo o contraseña incorrectos');
            return Http::json($res, ['user' => Auth::publicUser($user), 'token' => Auth::signToken($user, $ctx->config->jwtSecret)]);
        });

        $app->get('/api/auth/me', function (Request $req, Response $res) use ($ctx) {
            $claims = Http::requireUser($req);
            $user = $ctx->db()->one('SELECT * FROM users WHERE id = ?', [$claims['sub']]);
            if (!$user) throw new HttpError(401, 'Sesión inválida');
            return Http::json($res, ['user' => Auth::publicUser($user)]);
        });
    }
}
