<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Middleware;

use MelodyQuest\Api\Exceptions\ApiException;
use MelodyQuest\Api\Responses;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpException;
use Throwable;

class ErrorHandler
{
    public function __construct(private ResponseFactoryInterface $responseFactory)
    {
    }

    public function __invoke(
        ServerRequestInterface $request,
        Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails
    ): ResponseInterface {
        $status = 500;
        $code = 'SERVER_ERROR';
        $message = 'An unexpected error occurred.';
        $details = [];

        if ($exception instanceof ApiException) {
            $status = $exception->getStatus();
            $code = $exception->getErrorCode();
            $message = $exception->getMessage();
            $details = $exception->getDetails();
        } elseif ($exception instanceof HttpException) {
            $status = $exception->getCode() > 0 ? $exception->getCode() : 500;
            $message = $exception->getMessage();
            $code = strtoupper(str_replace(' ', '_', $exception->getTitle() ?: 'HTTP_ERROR'));
        } else {
            $message = $exception->getMessage() !== '' ? $exception->getMessage() : $message;
        }

        if ($displayErrorDetails) {
            $details['exception'] = [
                'type' => $exception::class,
                'message' => $exception->getMessage(),
                'trace' => explode("\n", $exception->getTraceAsString()),
            ];
        }

        return Responses::jsonErr($this->responseFactory, $code, $message, $status, $details);
    }
}
