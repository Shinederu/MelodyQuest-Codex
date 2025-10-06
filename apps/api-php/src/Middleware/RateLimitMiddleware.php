<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Middleware;

use DateTimeImmutable;
use MelodyQuest\Api\Responses;
use Predis\ClientInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

class RateLimitMiddleware implements MiddlewareInterface
{
    public function __construct(
        private ClientInterface $redis,
        private int $limitPerMinute,
        private ResponseFactoryInterface $responseFactory
    ) {
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            return $handler->handle($request);
        }

        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? 'unknown';
        $minute = (new DateTimeImmutable('now'))->format('YmdHi');
        $key = sprintf('ratelimit:%s:%s', $ip, $minute);
        $count = (int) $this->redis->incr($key);
        if ($count === 1) {
            $this->redis->expire($key, 60);
        }

        if ($count > $this->limitPerMinute) {
            return Responses::jsonErr(
                $this->responseFactory,
                'RATE_LIMIT_EXCEEDED',
                'Too many requests',
                429,
                ['limit_per_minute' => $this->limitPerMinute]
            );
        }

        return $handler->handle($request);
    }
}
