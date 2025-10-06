<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Routes;

use Illuminate\Database\QueryException;
use MelodyQuest\Api\Middleware\AdminAuthMiddleware;
use MelodyQuest\Api\Models\Category;
use MelodyQuest\Api\Models\Track;
use MelodyQuest\Api\Responses;
use MelodyQuest\Api\Services\TrackService;
use Respect\Validation\Exceptions\NestedValidationException;
use Respect\Validation\Validator as v;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

class AdminRoutes
{
    public static function register(App $app, TrackService $trackService, AdminAuthMiddleware $adminAuth): void
    {
        $responseFactory = $app->getResponseFactory();

        $app->group('/api/admin', function (RouteCollectorProxy $group) use ($trackService, $responseFactory) {
            $group->post('/categories', function ($request) use ($responseFactory) {
                $body = (array) $request->getParsedBody();

                $validator = v::key('name', v::stringType()->length(1, 128));

                try {
                    $validator->assert($body);
                } catch (NestedValidationException $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'VALIDATION_ERROR',
                        'Invalid category data',
                        422,
                        $exception->getMessages()
                    );
                }

                try {
                    $category = Category::create([
                        'name' => trim($body['name']),
                        'is_active' => 1,
                    ]);
                } catch (QueryException $exception) {
                    if (str_contains(strtolower($exception->getMessage()), 'duplicate')) {
                        return Responses::jsonErr($responseFactory, 'CATEGORY_EXISTS', 'Category already exists', 409);
                    }

                    throw $exception;
                }

                return Responses::jsonOk($responseFactory, $category->toArray(), 201);
            });

            $group->get('/categories', function () use ($responseFactory) {
                $categories = Category::orderBy('name')->get();
                return Responses::jsonOk($responseFactory, $categories->toArray());
            });

            $group->patch('/categories/{id}', function ($request, $response, array $args) use ($responseFactory) {
                $body = (array) $request->getParsedBody();
                $category = Category::find($args['id']);

                if (!$category) {
                    return Responses::jsonErr($responseFactory, 'NOT_FOUND', 'Category not found', 404);
                }

                $validator = v::arrayType()->notEmpty();
                try {
                    $validator->assert($body);
                } catch (NestedValidationException $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'VALIDATION_ERROR',
                        'Invalid category data',
                        422,
                        $exception->getMessages()
                    );
                }

                if (array_key_exists('name', $body)) {
                    $category->name = trim((string) $body['name']);
                }
                if (array_key_exists('is_active', $body)) {
                    $category->is_active = (int) $body['is_active'] ? 1 : 0;
                }
                try {
                    $category->save();
                } catch (QueryException $exception) {
                    if (str_contains(strtolower($exception->getMessage()), 'duplicate')) {
                        return Responses::jsonErr($responseFactory, 'CATEGORY_EXISTS', 'Category already exists', 409);
                    }

                    throw $exception;
                }

                return Responses::jsonOk($responseFactory, $category->toArray());
            });

            $group->post('/tracks', function ($request) use ($trackService, $responseFactory) {
                $body = (array) $request->getParsedBody();

                $validator = v::key('youtube_url', v::stringType()->length(1, 255))
                    ->key('category_id', v::intType()->positive())
                    ->key('answers', v::arrayType(), false)
                    ->key('title', v::optional(v::stringType()->length(0, 255)))
                    ->key('cover_image_url', v::optional(v::stringType()->length(0, 255)));

                try {
                    $validator->assert($body);
                } catch (NestedValidationException $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'VALIDATION_ERROR',
                        'Invalid track data',
                        422,
                        $exception->getMessages()
                    );
                }

                try {
                    $track = $trackService->addTrack($body);
                } catch (\Throwable $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'TRACK_CREATION_FAILED',
                        $exception->getMessage(),
                        400
                    );
                }

                return Responses::jsonOk($responseFactory, $track->toArray(), 201);
            });

            $group->get('/tracks', function ($request) use ($trackService, $responseFactory) {
                $categoryId = $request->getQueryParams()['category_id'] ?? null;
                $q = $request->getQueryParams()['q'] ?? null;

                $categoryId = $categoryId !== null ? (int) $categoryId : null;
                $q = $q !== null ? trim((string) $q) : null;

                $tracks = $trackService->searchTracks($categoryId, $q);

                return Responses::jsonOk($responseFactory, $tracks->toArray());
            });

            $group->post('/tracks/{id}/answers', function ($request, $response, array $args) use ($trackService, $responseFactory) {
                $body = (array) $request->getParsedBody();
                $validator = v::key('answers', v::arrayType()->notEmpty());

                try {
                    $validator->assert($body);
                } catch (NestedValidationException $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'VALIDATION_ERROR',
                        'Invalid answers payload',
                        422,
                        $exception->getMessages()
                    );
                }

                $track = Track::find($args['id']);
                if (!$track) {
                    return Responses::jsonErr($responseFactory, 'NOT_FOUND', 'Track not found', 404);
                }

                try {
                    $track = $trackService->addAnswers($track, $body['answers']);
                } catch (\Throwable $exception) {
                    return Responses::jsonErr(
                        $responseFactory,
                        'TRACK_UPDATE_FAILED',
                        $exception->getMessage(),
                        400
                    );
                }

                return Responses::jsonOk($responseFactory, $track->toArray());
            });
        })->add($adminAuth);
    }
}
