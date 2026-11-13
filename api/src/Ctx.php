<?php
declare(strict_types=1);

namespace SneakerLab;

use Psr\Http\Message\ServerRequestInterface as Request;

/** Dependencias compartidas por las rutas. La conexión a la base de datos se abre bajo demanda. */
final class Ctx
{
    private ?Db $db = null;
    public readonly Storage $storage;

    public function __construct(public readonly Config $config)
    {
        $this->storage = new Storage($config->storageDir, $config->uploadsPublicBase);
    }

    public function db(): Db
    {
        return $this->db ??= new Db($this->config);
    }

    /** Hora actual. En APP_ENV=test se puede fijar con la cabecera X-Test-Now (pruebas de caducidad). */
    public function now(Request $req): \DateTimeImmutable
    {
        $fixed = $this->config->isTest() ? $req->getHeaderLine('X-Test-Now') : '';
        return new \DateTimeImmutable($fixed !== '' ? $fixed : 'now', new \DateTimeZone('UTC'));
    }
}
