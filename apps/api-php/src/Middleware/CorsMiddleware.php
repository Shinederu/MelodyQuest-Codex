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
        $originHeader = trim($request->getHeaderLine('Origin'));
        $origin = $originHeader === '' ? null : $originHeader;

        $uri = $request->getUri();
        $schemeHost = $uri->getScheme() . '://' . $uri->getHost();
        $port = $uri->getPort();
        if ($port !== null && !$this->isDefaultPort($uri->getScheme(), $port)) {
            $schemeHost .= ':' . $port;
        }

        $isSameOrigin = $origin === null || $origin === $schemeHost;

        $originAllowed = $isSameOrigin;
        if (!$originAllowed && $origin !== null) {
            if ($this->allowAll || in_array('*', $this->allowedOrigins, true)) {
                $originAllowed = true;
            } else {
                $originAllowed = in_array($origin, $this->allowedOrigins, true);
            }
        }

        if (!$originAllowed) {
            return Responses::jsonErr($this->responseFactory, 'CORS_NOT_ALLOWED', 'Origin not allowed', 403);
        }

        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            $response = $this->responseFactory->createResponse(204);

            return $this->applyHeaders(
                $response->withHeader('Access-Control-Max-Age', '86400'),
                $origin,
                $isSameOrigin
            );
        }

        $response = $handler->handle($request);

        return $this->applyHeaders($response, $origin, $isSameOrigin);
    }

    private function applyHeaders(ResponseInterface $response, ?string $origin, bool $isSameOrigin): ResponseInterface
    {
        $response = $response
            ->withHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Admin-Token, Authorization');

        if (!$isSameOrigin && $origin !== null) {
            $response = $response
                ->withHeader('Access-Control-Allow-Origin', $origin)
                ->withHeader('Access-Control-Allow-Credentials', 'true')
                ->withHeader('Vary', 'Origin');
        }

        return $response;
    }

    private function isDefaultPort(string $scheme, int $port): bool
    {
        return ($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80);
    }
}
