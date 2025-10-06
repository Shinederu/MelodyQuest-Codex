<?php

declare(strict_types=1);

namespace MelodyQuest\Api;

use Predis\Client;

class RedisBus
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public static function create(): self
    {
        $client = new Client([
            'scheme' => 'tcp',
            'host' => Config::env('REDIS_HOST', 'redis'),
            'port' => Config::envInt('REDIS_PORT', 6379),
        ], [
            'parameters' => [
                'password' => Config::env('REDIS_PASSWORD'),
            ],
        ]);

        return new self($client);
    }

    public function client(): Client
    {
        return $this->client;
    }

    public function publish(string $channel, array $payload): void
    {
        $this->client->publish($channel, json_encode($payload, JSON_THROW_ON_ERROR));
    }

    public static function channelGame(int $gameId): string
    {
        return sprintf('game:%d', $gameId);
    }
}
