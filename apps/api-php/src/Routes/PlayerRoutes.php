<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Routes;

use MelodyQuest\Api\Config;
use MelodyQuest\Api\Exceptions\ApiException;
use MelodyQuest\Api\Models\User;
use MelodyQuest\Api\Responses;
use MelodyQuest\Api\Services\GameService;
use MelodyQuest\Api\Services\GuessService;
use Respect\Validation\Exceptions\NestedValidationException;
use Respect\Validation\Validator as v;
use Slim\App;

class PlayerRoutes
{
    public static function register(App $app, GameService $gameService, GuessService $guessService): void
    {
        $responseFactory = $app->getResponseFactory();

        $app->post('/api/token/guest', function ($request) use ($responseFactory) {
            $body = (array) ($request->getParsedBody() ?? []);
            $username = trim((string) ($body['username'] ?? ''));
            $userId = (int) ($body['user_id'] ?? 0);

            if ($userId <= 0 || $username === '') {
                return Responses::jsonErr($responseFactory, 'VALIDATION_ERROR', 'username and user_id are required', 422);
            }

            $user = User::find($userId);
            if ($user === null || $user->username !== $username) {
                return Responses::jsonErr($responseFactory, 'NOT_FOUND', 'user not found', 404);
            }

            $secret = (string) Config::env('REALTIME_HMAC_SECRET', '');
            if ($secret === '') {
                return Responses::jsonErr($responseFactory, 'CONFIG_ERROR', 'REALTIME_HMAC_SECRET missing', 500);
            }

            $msg = sprintf('%d.%s', $userId, $username);
            $sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $msg, $secret, true)), '+/', '-_'), '=');

            return Responses::jsonOk($responseFactory, ['token' => $sig]);
        });

        $app->post('/api/users', function ($request) use ($responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('username', v::stringType()->length(1, 64));

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid user data',
                    422,
                    $exception->getMessages()
                );
            }

            $username = trim($body['username']);
            $user = User::firstOrCreate(['username' => $username]);

            $status = $user->wasRecentlyCreated ? 201 : 200;

            return Responses::jsonOk($responseFactory, $user->toArray(), $status);
        });

        $app->post('/api/games', function ($request) use ($gameService, $responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('host_user_id', v::intType()->positive())
                ->key('round_count', v::intType()->positive())
                ->key('category_ids', v::arrayType()->notEmpty());

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid game data',
                    422,
                    $exception->getMessages()
                );
            }

            try {
                $game = $gameService->createGame((int) $body['host_user_id'], (int) $body['round_count'], $body['category_ids']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            return Responses::jsonOk($responseFactory, $game->toArray(), 201);
        });

        $app->post('/api/games/{id}/join', function ($request, $response, array $args) use ($gameService, $responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('user_id', v::intType()->positive());

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid join payload',
                    422,
                    $exception->getMessages()
                );
            }

            try {
                $result = $gameService->addPlayer((int) $args['id'], (int) $body['user_id']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            $status = $result['created'] ? 201 : 200;

            return Responses::jsonOk($responseFactory, $result['player']->toArray(), $status);
        });

        $app->post('/api/games/{id}/start', function ($request, $response, array $args) use ($gameService, $responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('user_id', v::intType()->positive());

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid start payload',
                    422,
                    $exception->getMessages()
                );
            }

            try {
                $round = $gameService->startGame((int) $args['id'], (int) $body['user_id']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            return Responses::jsonOk($responseFactory, $round->toArray());
        });

        $app->get('/api/games/{id}/state', function ($request, $response, array $args) use ($gameService, $responseFactory) {
            try {
                $state = $gameService->getState((int) $args['id']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            return Responses::jsonOk($responseFactory, $state);
        });

        $app->post('/api/games/{id}/next', function ($request, $response, array $args) use ($gameService, $responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('user_id', v::intType()->positive());

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid next payload',
                    422,
                    $exception->getMessages()
                );
            }

            try {
                $round = $gameService->nextRound((int) $args['id'], (int) $body['user_id']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            return Responses::jsonOk($responseFactory, $round->toArray());
        });

        $app->post('/api/rounds/{id}/guess', function ($request, $response, array $args) use ($guessService, $responseFactory) {
            $body = (array) $request->getParsedBody();
            $validator = v::key('user_id', v::intType()->positive())
                ->key('guess_text', v::stringType()->length(1, 255));

            try {
                $validator->assert($body);
            } catch (NestedValidationException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    'VALIDATION_ERROR',
                    'Invalid guess payload',
                    422,
                    $exception->getMessages()
                );
            }

            try {
                $result = $guessService->submitGuess((int) $args['id'], (int) $body['user_id'], (string) $body['guess_text']);
            } catch (ApiException $exception) {
                return Responses::jsonErr(
                    $responseFactory,
                    $exception->getErrorCode(),
                    $exception->getMessage(),
                    $exception->getStatus(),
                    $exception->getDetails()
                );
            }

            return Responses::jsonOk($responseFactory, $result);
        });
    }
}
