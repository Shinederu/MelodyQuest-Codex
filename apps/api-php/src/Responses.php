<?php

declare(strict_types=1);

namespace MelodyQuest\Api;

use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;

class Responses
{
    public static function jsonOk(ResponseFactoryInterface $factory, mixed $data, int $status = 200): ResponseInterface
    {
        $response = $factory->createResponse($status);
        $payload = [
            'ok' => true,
            'data' => $data,
        ];

        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json');
    }

    public static function jsonErr(
        ResponseFactoryInterface $factory,
        string $code,
        string $message,
        int $status = 400,
        array $details = []
    ): ResponseInterface {
        $response = $factory->createResponse($status);
        $payload = [
            'ok' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];

        if ($details !== []) {
            $payload['error']['details'] = $details;
        }

        $response->getBody()->write(json_encode($payload, JSON_THROW_ON_ERROR));

        return $response->withHeader('Content-Type', 'application/json');
    }
}
