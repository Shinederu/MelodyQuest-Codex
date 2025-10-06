<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Middleware;

use MelodyQuest\Api\Responses;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class JsonBodyParser implements MiddlewareInterface
{
    public function __construct(private ResponseFactoryInterface $responseFactory)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $method = strtoupper($request->getMethod());
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $handler->handle($request);
        }

        $contentType = $request->getHeaderLine('Content-Type');
        if ($contentType === '') {
            return Responses::jsonErr($this->responseFactory, 'INVALID_CONTENT_TYPE', 'Content-Type header required', 415);
        }

        if (!str_contains(strtolower($contentType), 'application/json')) {
            return Responses::jsonErr($this->responseFactory, 'INVALID_CONTENT_TYPE', 'Content-Type must be application/json', 415);
        }

        $body = (string) $request->getBody();
        if ($body === '') {
            $parsed = [];
        } else {
            try {
                $parsed = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $exception) {
                return Responses::jsonErr($this->responseFactory, 'INVALID_JSON', 'Malformed JSON payload', 400, [
                    'message' => $exception->getMessage(),
                ]);
            }
        }

        if (!is_array($parsed)) {
            return Responses::jsonErr($this->responseFactory, 'INVALID_JSON', 'JSON body must decode to an object', 400);
        }

        return $handler->handle($request->withParsedBody($parsed));
    }
}
