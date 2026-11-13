<?php
declare(strict_types=1);

namespace SneakerLab;

/** Error HTTP con mensaje para el cliente (mismo formato que el API anterior: { error, details? }). */
final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, string $message, public readonly mixed $details = null)
    {
        parent::__construct($message, $status);
    }

    public static function notFound(string $what = 'Recurso'): self
    {
        return new self(404, "$what no encontrado");
    }
}
