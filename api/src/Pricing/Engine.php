<?php
declare(strict_types=1);

namespace SneakerLab\Pricing;

use SneakerLab\Contracts;

/**
 * Motor de cotización. Función pura: documento + reglas activas → desglose.
 * Los precios salen siempre de las reglas del servidor; el cliente nunca envía importes.
 * Port 1:1 del motor TypeScript anterior; tests/fixtures/pricing.json fija sus resultados.
 *
 * Regla: array{kind:string,target:?string,label:string,amount:float,factor:float,active:bool}
 */
final class Engine
{
    /** Reglas iniciales (semilla). Editables desde administración. */
    public const DEFAULT_RULES = [
        ['kind' => 'base_model', 'target' => 'court-low-01', 'label' => 'Court Low — par base', 'amount' => 89, 'factor' => 1],
        ['kind' => 'base_model', 'target' => 'court-classic-01', 'label' => 'Court Classic — par base', 'amount' => 89, 'factor' => 1],
        ['kind' => 'base_model', 'target' => 'sneaker-low-01', 'label' => 'Classic Low (provisional) — par base', 'amount' => 79, 'factor' => 1],
        ['kind' => 'per_zone', 'target' => null, 'label' => 'Zona personalizada', 'amount' => 6, 'factor' => 1],
        ['kind' => 'per_image', 'target' => null, 'label' => 'Ilustración impresa', 'amount' => 9, 'factor' => 1],
        ['kind' => 'per_text', 'target' => null, 'label' => 'Texto personalizado', 'amount' => 4, 'factor' => 1],
        ['kind' => 'per_pattern', 'target' => null, 'label' => 'Patrón', 'amount' => 5, 'factor' => 1],
        ['kind' => 'material_factor', 'target' => 'suede', 'label' => 'Gamuza', 'amount' => 0, 'factor' => 1.15],
        ['kind' => 'material_factor', 'target' => 'mesh', 'label' => 'Malla técnica', 'amount' => 0, 'factor' => 1.1],
        ['kind' => 'complexity', 'target' => null, 'label' => 'Diseño complejo', 'amount' => 0, 'factor' => 1.25],
        ['kind' => 'finish', 'target' => 'matte-protect', 'label' => 'Acabado protector mate', 'amount' => 12, 'factor' => 1],
        ['kind' => 'finish', 'target' => 'gloss', 'label' => 'Acabado brillante', 'amount' => 12, 'factor' => 1],
        ['kind' => 'service', 'target' => 'gift-box', 'label' => 'Caja de regalo', 'amount' => 8, 'factor' => 1],
        ['kind' => 'service', 'target' => 'express', 'label' => 'Producción exprés (7 días)', 'amount' => 25, 'factor' => 1],
    ];

    /** Igual que Math.round(n * 100) / 100 en JS (round() de PHP pre-redondea y difiere en casos límite). */
    public static function round(float $n): float
    {
        return floor($n * 100 + 0.5) / 100;
    }

    /**
     * @param array<string,mixed> $model entrada de catalog.json
     * @param list<array<string,mixed>> $rules
     * @param array{services?:list<string>,finish?:string} $extras
     * @return array<string,mixed>
     */
    public static function compute(\stdClass $doc, array $model, array $rules, array $extras = []): array
    {
        $active = array_values(array_filter($rules, fn ($r) => $r['active'] ?? true));
        $find = function (string $kind, ?string $target = null) use ($active): ?array {
            foreach ($active as $r) if ($r['kind'] === $kind && ($r['target'] ?? null) === $target) return $r;
            foreach ($active as $r) if ($r['kind'] === $kind && $r['target'] === null) return $r;
            return null;
        };
        $lines = [];
        $line = fn (string $code, string $label, int|float $qty, float $unit, float $amount, string $group) => ['code' => $code, 'label' => $label, 'qty' => $qty, 'unit' => self::num($unit), 'amount' => self::num($amount), 'group' => $group];

        // Base del modelo
        $base = $find('base_model', $model['modelId']);
        if (!$base) throw new \DomainException("Sin precio base configurado para el modelo {$model['modelId']}");
        $lines[] = $line('base', $base['label'], 1, (float) $base['amount'], (float) $base['amount'], 'base');

        $layers = is_array($doc->layers ?? null) ? $doc->layers : [];

        // Zonas personalizadas: color distinto al de fábrica, material distinto o con capas
        $zonesCustomized = 0;
        $materialSurcharge = 0.0;
        foreach (['right', 'left'] as $side) {
            foreach ($model['zones'] as $zone) {
                $st = $doc->shoes->$side->zones->{$zone['id']} ?? null;
                if (!$st) continue;
                $hasLayers = false;
                foreach ($layers as $l) if ($l->shoe === $side && $l->zoneId === $zone['id'] && $l->visible) { $hasLayers = true; break; }
                $colorChanged = strtolower((string) $st->color) !== strtolower((string) $zone['defaultColor']);
                $material = $st->material ?? null;
                $materialChanged = !empty($material) && $material !== $zone['material'];
                if ($hasLayers || $colorChanged || $materialChanged) $zonesCustomized++;
                if ($materialChanged) {
                    $rule = $find('material_factor', $material);
                    $factor = $rule ? (float) $rule['factor'] : Contracts::materialFactor($material);
                    $perZone = (float) ($find('per_zone')['amount'] ?? 0);
                    $materialSurcharge += $perZone * max(0, $factor - 1);
                }
            }
        }
        $perZone = $find('per_zone');
        if ($perZone && $zonesCustomized) $lines[] = $line('zones', $perZone['label'], $zonesCustomized, (float) $perZone['amount'], self::round($zonesCustomized * $perZone['amount']), 'customization');
        if ($materialSurcharge > 0) $lines[] = $line('materials', 'Materiales especiales', 1, self::round($materialSurcharge), self::round($materialSurcharge), 'customization');

        // Capas por tipo
        $visible = array_values(array_filter($layers, fn ($l) => $l->visible));
        $count = fn (string $kind) => count(array_filter($visible, fn ($l) => $l->kind === $kind));
        foreach ([['image', 'per_image', 'images'], ['text', 'per_text', 'texts'], ['pattern', 'per_pattern', 'patterns']] as [$kind, $ruleKind, $code]) {
            $r = $find($ruleKind);
            $n = $count($kind);
            if ($r && $n) $lines[] = $line($code, $r['label'], $n, (float) $r['amount'], self::round($n * $r['amount']), 'customization');
        }

        // Complejidad: capas totales y uso de máscaras/repeticiones/curvas elevan el factor
        $fancy = count(array_filter($visible, fn ($l) => (isset($l->mask) && $l->mask !== 'none')
            || (isset($l->repeat) && $l->repeat->count > 1)
            || !empty($l->mirror)
            || ($l->kind === 'text' && abs($l->curve) > 0.02)));
        $complexity = min(1, count($visible) * 0.06 + $fancy * 0.08 + $zonesCustomized * 0.03);
        $cx = $find('complexity');
        if ($cx && $complexity > 0.35) {
            $custom = 0.0;
            foreach ($lines as $l) if ($l['group'] === 'customization') $custom += $l['amount'];
            $amount = self::round(($cx['factor'] - 1) * $custom * $complexity);
            if ($amount > 0) $lines[] = $line('complexity', $cx['label'], 1, $amount, $amount, 'customization');
        }

        // Extras: acabado y servicios adicionales elegidos
        if (!empty($extras['finish'])) {
            $r = $find('finish', $extras['finish']);
            if ($r) $lines[] = $line("finish:{$extras['finish']}", $r['label'], 1, (float) $r['amount'], (float) $r['amount'], 'extras');
        }
        foreach ($extras['services'] ?? [] as $svc) {
            $r = $find('service', $svc);
            if ($r) $lines[] = $line("service:$svc", $r['label'], 1, (float) $r['amount'], (float) $r['amount'], 'extras');
        }

        $sum = function (string $g) use ($lines): float {
            $s = 0.0;
            foreach ($lines as $l) if ($l['group'] === $g) $s += $l['amount'];
            return self::round($s);
        };
        $basePrice = $sum('base');
        $customization = $sum('customization');
        $ex = $sum('extras');
        return [
            'currency' => 'USD',
            'basePrice' => self::num($basePrice),
            'customization' => self::num($customization),
            'extras' => self::num($ex),
            'total' => self::num(self::round($basePrice + $customization + $ex)),
            'lines' => $lines,
            'complexity' => self::num(self::round($complexity)),
        ];
    }

    /** Entero si no tiene decimales (JSON igual que JS: 89, no 89.0). */
    private static function num(float|int $n): int|float
    {
        return (float) $n === floor((float) $n) && abs($n) < PHP_INT_MAX ? (int) $n : (float) $n;
    }
}
