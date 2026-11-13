<?php
declare(strict_types=1);

namespace SneakerLab;

/**
 * Validación de cuerpos simples (equivalente a los esquemas zod del API anterior).
 * Cada regla recibe el valor (o MISSING) y devuelve el valor limpio o lanza un mensaje.
 * Errores → 422 { error: "Datos inválidos", details: ["campo: mensaje", ...] }.
 */
final class Validator
{
    public const MISSING = "\0__missing__";

    /**
     * @param array<string, callable(mixed):mixed> $shape
     * @return array<string,mixed> solo las claves presentes o con valor por defecto
     */
    public static function object(\stdClass $body, array $shape, string $prefix = ''): array
    {
        $out = [];
        $issues = [];
        foreach ($shape as $key => $rule) {
            $value = property_exists($body, $key) ? $body->$key : self::MISSING;
            try {
                $clean = $rule($value);
                if ($clean !== self::MISSING) $out[$key] = $clean;
            } catch (ValidationIssue $e) {
                foreach ($e->issues as $i) $issues[] = $prefix . $key . $i;
            }
        }
        if ($issues) throw new HttpError(422, 'Datos inválidos', $issues);
        return $out;
    }

    /** Hace opcionales todas las reglas (equivalente a zod .partial()). */
    public static function partial(array $shape): array
    {
        // Solo las claves ausentes se omiten; un null explícito llega a la regla (p. ej. target nullable).
        return array_map(fn ($rule) => fn ($v) => $v === self::MISSING ? self::MISSING : $rule($v), $shape);
    }

    public static function fail(string $msg): never
    {
        throw new ValidationIssue([": $msg"]);
    }

    public static function optional(callable $rule): \Closure
    {
        return fn ($v) => $v === self::MISSING || $v === null ? self::MISSING : $rule($v);
    }

    public static function withDefault(callable $rule, mixed $default): \Closure
    {
        return fn ($v) => $v === self::MISSING ? $default : $rule($v);
    }

    public static function nullable(callable $rule): \Closure
    {
        return fn ($v) => $v === null ? null : $rule($v);
    }

    public static function string(int $min = 0, int $max = PHP_INT_MAX, bool $trim = false, ?string $regex = null, ?int $length = null): \Closure
    {
        return function ($v) use ($min, $max, $trim, $regex, $length) {
            if ($v === self::MISSING) self::fail('Requerido');
            if (!is_string($v)) self::fail('Se esperaba texto');
            if ($trim) $v = trim($v);
            $len = mb_strlen($v);
            if ($length !== null && $len !== $length) self::fail("Debe tener exactamente $length caracteres");
            if ($len < $min) self::fail($min === 1 ? 'No puede estar vacío' : "Mínimo $min caracteres");
            if ($len > $max) self::fail("Máximo $max caracteres");
            if ($regex !== null && !preg_match($regex, $v)) self::fail('Formato inválido');
            return $v;
        };
    }

    public static function email(): \Closure
    {
        return function ($v) {
            if ($v === self::MISSING) self::fail('Requerido');
            if (!is_string($v) || mb_strlen($v) > 200 || !filter_var(trim($v), FILTER_VALIDATE_EMAIL)) self::fail('Correo inválido');
            return strtolower(trim($v));
        };
    }

    public static function number(float $min = -INF, float $max = INF, bool $int = false, bool $positive = false): \Closure
    {
        return function ($v) use ($min, $max, $int, $positive) {
            if ($v === self::MISSING) self::fail('Requerido');
            if (!is_int($v) && !is_float($v)) self::fail('Se esperaba un número');
            if ($int && (float) (int) $v !== (float) $v) self::fail('Se esperaba un entero');
            if ($positive && $v <= 0) self::fail('Debe ser positivo');
            if ($v < $min) self::fail("Mínimo $min");
            if ($v > $max) self::fail("Máximo $max");
            return $int ? (int) $v : $v;
        };
    }

    public static function bool(): \Closure
    {
        return function ($v) {
            if (!is_bool($v)) self::fail($v === self::MISSING ? 'Requerido' : 'Se esperaba verdadero o falso');
            return $v;
        };
    }

    /** @param string[] $values */
    public static function enum(array $values): \Closure
    {
        return function ($v) use ($values) {
            if (!is_string($v) || !in_array($v, $values, true)) self::fail('Valor no permitido: se esperaba ' . implode(' | ', $values));
            return $v;
        };
    }

    public static function arrayOf(callable $item, int $max = PHP_INT_MAX): \Closure
    {
        return function ($v) use ($item, $max) {
            if (!is_array($v) || !array_is_list($v)) self::fail('Se esperaba una lista');
            if (count($v) > $max) self::fail("Máximo $max elementos");
            $out = [];
            foreach ($v as $i => $x) {
                try {
                    $out[] = $item($x);
                } catch (ValidationIssue $e) {
                    throw new ValidationIssue(array_map(fn ($m) => ".$i" . $m, $e->issues));
                }
            }
            return $out;
        };
    }

    /** Objeto anidado: devuelve stdClass con las claves validadas (descarta las desconocidas). */
    public static function shape(array $shape): \Closure
    {
        return function ($v) use ($shape) {
            if ($v === self::MISSING) self::fail('Requerido');
            if (!$v instanceof \stdClass) self::fail('Se esperaba un objeto');
            try {
                return (object) self::object($v, $shape);
            } catch (HttpError $e) {
                throw new ValidationIssue(array_map(fn ($m) => ".$m", (array) $e->details));
            }
        };
    }

    /** Cualquier valor presente (zod unknown). */
    public static function any(): \Closure
    {
        return fn ($v) => $v === self::MISSING ? null : $v;
    }
}
