<?php

declare(strict_types=1);

use MelodyQuest\Api\Config;
use MelodyQuest\Api\Database;
use MelodyQuest\Api\Middleware\AdminAuthMiddleware;
use MelodyQuest\Api\Middleware\CorsMiddleware;
use MelodyQuest\Api\Middleware\ErrorHandler;
use MelodyQuest\Api\Middleware\JsonBodyParser;
use MelodyQuest\Api\Middleware\RateLimitMiddleware;
use MelodyQuest\Api\RedisBus;
use MelodyQuest\Api\Routes\AdminRoutes;
use MelodyQuest\Api\Routes\HealthRoutes;
use MelodyQuest\Api\Routes\PlayerRoutes;
use MelodyQuest\Api\Services\GameService;
use MelodyQuest\Api\Services\GuessService;
use MelodyQuest\Api\Services\TrackService;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

Config::load(dirname(__DIR__, 2));
Database::boot();
$redisBus = RedisBus::create();

$app = AppFactory::create();
$app->addRoutingMiddleware();

$errorMiddleware = $app->addErrorMiddleware(Config::isDevelopment(), true, true);
$errorMiddleware->setDefaultErrorHandler(new ErrorHandler($app->getResponseFactory()));

$app->add(new CorsMiddleware($app->getResponseFactory(), Config::allowedOrigins(), Config::isDevelopment()));
$app->add(new RateLimitMiddleware($redisBus->client(), Config::rateLimitPerMinute(), $app->getResponseFactory()));
$app->add(new JsonBodyParser($app->getResponseFactory()));

$trackService = new TrackService();
$gameService = new GameService($redisBus);
$guessService = new GuessService($redisBus);
$adminMiddleware = new AdminAuthMiddleware(Config::adminToken(), $app->getResponseFactory());

HealthRoutes::register($app);
AdminRoutes::register($app, $trackService, $adminMiddleware);
PlayerRoutes::register($app, $gameService, $guessService);

return $app;
