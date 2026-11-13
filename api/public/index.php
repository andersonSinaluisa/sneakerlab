<?php
declare(strict_types=1);

/**
 * Front controller del API. En Hostinger, public_html/api/index.php solo hace
 *   require __DIR__ . '/../../sneakerlab-api/public/index.php';
 * para que el código, vendor/, .env y las subidas queden fuera de public_html.
 */

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

SneakerLab\App::create($root)->run();
