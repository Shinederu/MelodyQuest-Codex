<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Middleware;

use MelodyQuest\Api\Responses;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class AdminAuthMiddleware implements MiddlewareInterface
{
    public function __construct(private string $adminToken, private ResponseFactoryInterface $responseFactory)
    {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $token = $request->getHeaderLine('X-Admin-Token');
        if ($token === '' || !hash_equals($this->adminToken, $token)) {
            return Responses::jsonErr($this->responseFactory, 'UNAUTHORIZED', 'Admin token invalid', 401);
        }

        return $handler->handle($request);
    }
}
