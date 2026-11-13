<?php
declare(strict_types=1);

/**
 * Aplica las migraciones pendientes (api/migrations/*.sql, en orden) y la semilla idempotente:
 * reglas de precio por defecto (si no hay ninguna) y admin inicial (ADMIN_EMAIL/ADMIN_PASSWORD).
 *
 *   php bin/migrate.php
 */

use SneakerLab\Auth;
use SneakerLab\Config;
use SneakerLab\Db;
use SneakerLab\Http;
use SneakerLab\Pricing\Engine;

// En hosting compartido display_errors suele estar desactivado también en CLI: sin esto, un fallo sale mudo.
ini_set('display_errors', '1');
error_reporting(E_ALL);

if (PHP_VERSION_ID < 80200) {
    fwrite(STDERR, 'Se necesita PHP 8.2+; este `php` es ' . PHP_VERSION . ". En Hostinger prueba: /opt/alt/php82/usr/bin/php bin/migrate.php\n");
    exit(1);
}

$root = dirname(__DIR__);
if (!is_file($root . '/vendor/autoload.php')) {
    fwrite(STDERR, "Falta vendor/autoload.php: sube la carpeta vendor/ (npm run build:hostinger la incluye).\n");
    exit(1);
}
require $root . '/vendor/autoload.php';

set_exception_handler(function (\Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
});

$config = Config::load($root);
$db = new Db($config);
$pdo = $db->pdo;

$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) NOT NULL PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB');
$applied = array_column($db->all('SELECT name FROM schema_migrations'), 'name');
$files = glob($root . '/migrations/*.sql') ?: [];
sort($files);
foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $applied, true)) continue;
    $sql = (string) file_get_contents($file);
    // Sentencias separadas por ";" al final de línea (el DDL de MySQL no es transaccional).
    foreach (preg_split('/;\s*$/m', $sql) ?: [] as $stmt) {
        $stmt = trim(preg_replace('/^\s*--.*$/m', '', $stmt) ?? '');
        if ($stmt !== '') $pdo->exec($stmt);
    }
    $db->insert('schema_migrations', ['name' => $name]);
    echo "Migración aplicada: $name\n";
}

$seeded = SneakerLab\Routes\Categories::seed($db);
if ($seeded) echo "$seeded estilos integrados añadidos\n";

if (!$db->one('SELECT id FROM price_rules LIMIT 1')) {
    foreach (Engine::DEFAULT_RULES as $r) {
        $db->insert('price_rules', ['id' => Http::uuid(), 'kind' => $r['kind'], 'target' => $r['target'], 'label' => $r['label'], 'amount' => Http::money((float) $r['amount']), 'factor' => number_format((float) $r['factor'], 3, '.', ''), 'active' => true]);
    }
    echo count(Engine::DEFAULT_RULES) . " reglas de precio iniciales\n";
}

// Modelos añadidos después de la semilla: crea su precio base si no existe ninguna regla para él
// (si administración la desactivó, se respeta y no se vuelve a crear).
foreach (Engine::DEFAULT_RULES as $r) {
    if ($r['kind'] !== 'base_model') continue;
    if ($db->one("SELECT id FROM price_rules WHERE kind = 'base_model' AND target = ?", [$r['target']])) continue;
    $db->insert('price_rules', ['id' => Http::uuid(), 'kind' => 'base_model', 'target' => $r['target'], 'label' => $r['label'], 'amount' => Http::money((float) $r['amount']), 'factor' => number_format((float) $r['factor'], 3, '.', ''), 'active' => true]);
    echo "Precio base añadido: {$r['target']} ({$r['amount']})\n";
}

if ($config->adminEmail && $config->adminPassword) {
    $email = strtolower($config->adminEmail);
    $found = $db->one('SELECT id, role FROM users WHERE email = ?', [$email]);
    if (!$found) {
        $db->insert('users', ['id' => Http::uuid(), 'email' => $email, 'name' => 'Administración', 'password_hash' => Auth::hashPassword($config->adminPassword), 'role' => 'admin']);
        echo "Admin creado: $email\n";
    } elseif ($found['role'] !== 'admin') {
        $db->run("UPDATE users SET role = 'admin' WHERE id = ?", [$found['id']]);
        echo "Usuario promovido a admin: $email\n";
    }
}

echo "Base de datos al día.\n";
