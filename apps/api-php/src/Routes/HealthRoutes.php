<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Routes;

use MelodyQuest\Api\Responses;
use Slim\App;

class HealthRoutes
{
    public static function register(App $app): void
    {
        $responseFactory = $app->getResponseFactory();

        $app->get('/api/health', function () use ($responseFactory) {
            return Responses::jsonOk($responseFactory, ['status' => 'ok']);
        });
    }
}
