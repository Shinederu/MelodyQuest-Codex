<?php

declare(strict_types=1);

$app = require __DIR__ . '/../bootstrap/app.php';
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

$app = AppFactory::create();

require __DIR__ . '/../src/bootstrap.php';

$app->get('/api/health', function (Request $request, Response $response): Response {
    $payload = json_encode(['status' => 'ok'], JSON_PRETTY_PRINT);
    $response->getBody()->write($payload ?: '');
    return $response->withHeader('Content-Type', 'application/json');
});

$app->map(['GET', 'POST', 'PUT', 'DELETE'], '/api/routes-placeholder', function (Request $request, Response $response): Response {
    $response->getBody()->write(json_encode([
        'message' => 'Define your routes here',
    ], JSON_PRETTY_PRINT) ?: '');
    return $response->withHeader('Content-Type', 'application/json');
});

$app->run();
