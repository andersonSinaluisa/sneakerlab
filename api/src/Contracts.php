<?php
declare(strict_types=1);

namespace SneakerLab;

use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator as SchemaValidator;

/**
 * Contratos generados desde el frontend (`npm run api:contracts` → api/contracts/):
 * esquema del DesignDocument, cuerpo de presets y catálogo (modelos, materiales, categorías).
 */
final class Contracts
{
    private static ?array $catalog = null;
    private static array $schemas = [];

    public static function dir(): string
    {
        return dirname(__DIR__) . '/contracts';
    }

    /** @return array{models:list<array>,materials:list<array>,categories:list<array>,groups:array} */
    public static function catalog(): array
    {
        return self::$catalog ??= json_decode((string) file_get_contents(self::dir() . '/catalog.json'), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return array<string,mixed>|null */
    public static function model(string $modelId): ?array
    {
        foreach (self::catalog()['models'] as $m) if ($m['modelId'] === $modelId) return $m;
        return null;
    }

    public static function materialFactor(string $id): float
    {
        foreach (self::catalog()['materials'] as $m) if ($m['id'] === $id) return (float) $m['priceFactor'];
        return 1.0;
    }

    /** @return list<string> errores legibles (vacío si es válido) */
    public static function validate(string $schema, mixed $data, int $limit = 5): array
    {
        $validator = new SchemaValidator();
        $validator->setMaxErrors($limit);
        $def = self::$schemas[$schema] ??= json_decode((string) file_get_contents(self::dir() . "/$schema.schema.json"), false, 512, JSON_THROW_ON_ERROR);
        $result = $validator->validate($data, $def);
        if ($result->isValid()) return [];
        $out = [];
        foreach ((new ErrorFormatter())->format($result->error(), false) as $path => $msg) $out[] = "$path: $msg";
        return array_slice($out, 0, $limit);
    }

    /**
     * Valida un DesignDocument (migrando v1 → v2) y comprueba que el modelo existe.
     * Lanza 422 si no es válido.
     */
    public static function parseDocument(mixed $input): \stdClass
    {
        $doc = self::migrate($input);
        $errors = $doc instanceof \stdClass ? self::validate('document', $doc) : ['(raíz): se esperaba un objeto'];
        if ($errors) throw new HttpError(422, 'Documento de diseño inválido', $errors);
        if (!self::model($doc->modelId)) throw new HttpError(422, "Modelo desconocido: {$doc->modelId}");
        return $doc;
    }

    private static function migrate(mixed $input): mixed
    {
        if ($input instanceof \stdClass && ($input->schemaVersion ?? null) === 1) {
            // v1 → v2: las capas eran solo de imagen; los campos nuevos son opcionales.
            $d = clone $input;
            $d->schemaVersion = 2;
            $d->layers = array_map(fn ($l) => (object) (['kind' => 'image'] + (array) $l), is_array($input->layers ?? null) ? $input->layers : []);
            return $d;
        }
        return $input;
    }
}
