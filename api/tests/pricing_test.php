<?php
declare(strict_types=1);

/**
 * Paridad del motor de precios con el motor TypeScript original.
 * tests/fixtures/pricing.json se generó con ese motor (documento + reglas + extras → desglose esperado).
 *
 *   php tests/pricing_test.php
 */

use SneakerLab\Contracts;
use SneakerLab\Pricing\Engine;

require dirname(__DIR__) . '/vendor/autoload.php';

$fixtures = json_decode((string) file_get_contents(__DIR__ . '/fixtures/pricing.json'), false, 512, JSON_THROW_ON_ERROR);
$toArray = fn ($v) => json_decode(json_encode($v), true);

// Las reglas por defecto de PHP deben ser las mismas que las del motor original.
$phpDefaults = array_map(fn ($r) => $r + ['active' => true], Engine::DEFAULT_RULES);
$failures = [];
if ($toArray($fixtures->defaultRules) != $phpDefaults) $failures[] = 'DEFAULT_RULES difiere del motor original';

$same = function ($a, $b) use (&$same): bool {
    if (is_array($a) && is_array($b)) {
        if (array_keys($a) !== array_keys($b)) return false;
        foreach ($a as $k => $v) if (!$same($v, $b[$k])) return false;
        return true;
    }
    if (is_numeric($a) && is_numeric($b)) return abs($a - $b) < 1e-9;
    return $a === $b;
};

foreach ($fixtures->cases as $case) {
    $schemaErrors = Contracts::validate('document', $case->doc);
    if ($schemaErrors) {
        $failures[] = "{$case->name}: el documento no pasa el contrato: " . implode('; ', $schemaErrors);
        continue;
    }
    $rules = $toArray($case->rules);
    $extras = $toArray($case->extras);
    try {
        $got = Engine::compute($case->doc, Contracts::model($case->doc->modelId), $rules, $extras);
    } catch (\DomainException $e) {
        $got = ['error' => $e->getMessage()];
    }
    $expected = $toArray($case->expected);
    if ($same($expected, $toArray($got))) {
        echo "  ✓ {$case->name}\n";
    } else {
        $failures[] = "{$case->name}\n    esperado: " . json_encode($expected, JSON_UNESCAPED_UNICODE) . "\n    obtenido: " . json_encode($got, JSON_UNESCAPED_UNICODE);
    }
}

// Redondeo idéntico a Math.round(n * 100) / 100 de JS.
foreach ([[1.005, 1.0], [2.675, 2.67], [0.125, 0.13], [10.0, 10.0]] as [$in, $out]) {
    if (Engine::round($in) !== $out) $failures[] = "round($in) = " . Engine::round($in) . ", esperado $out";
}

if ($failures) {
    fwrite(STDERR, "\n✗ " . count($failures) . " fallo(s):\n  " . implode("\n  ", $failures) . "\n");
    exit(1);
}
echo "\nMotor de precios: " . count($fixtures->cases) . " casos idénticos al motor original.\n";
