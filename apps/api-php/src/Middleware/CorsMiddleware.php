<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Middleware;

use MelodyQuest\Api\Responses;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class CorsMiddleware implements MiddlewareInterface
{
    /**
     * @param array<int, string> $allowedOrigins
     */
    public function __construct(
        private ResponseFactoryInterface $responseFactory,
        private array $allowedOrigins,
        private bool $allowAll
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        $isAllowed = $this->allowAll || $origin === '' || in_array($origin, $this->allowedOrigins, true);

        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            if (!$isAllowed) {
                return Responses::jsonErr($this->responseFactory, 'CORS_NOT_ALLOWED', 'Origin not allowed', 403);
            }

            $response = $this->responseFactory->createResponse(204);
            return $this->applyHeaders($response, $origin);
        }

        if (!$isAllowed) {
            return Responses::jsonErr($this->responseFactory, 'CORS_NOT_ALLOWED', 'Origin not allowed', 403);
        }

        $response = $handler->handle($request);

        return $this->applyHeaders($response, $origin);
    }

    private function applyHeaders(ResponseInterface $response, string $origin): ResponseInterface
    {
        $allowOrigin = $this->allowAll ? ($origin !== '' ? $origin : '*') : $origin;

        return $response
            ->withHeader('Access-Control-Allow-Origin', $allowOrigin === '' ? '*' : $allowOrigin)
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
            ->withHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true');
    }
}
