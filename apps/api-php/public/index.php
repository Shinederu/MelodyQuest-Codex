<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

if (($_SERVER['REQUEST_URI'] ?? '') === '/api/health'
    && ($_SERVER['HTTP_USER_AGENT'] ?? '') === 'HAProxy-HealthCheck') {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true]);
    exit;
}

/** @var \Slim\App $app */
$app = require __DIR__ . '/../bootstrap/app.php';
$app->run();
