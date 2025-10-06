<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Exceptions;

use RuntimeException;

class ApiException extends RuntimeException
{
    public function __construct(
        string $message,
        private int $status = 400,
        private string $errorCode = 'BAD_REQUEST',
        private array $details = []
    ) {
        parent::__construct($message, $status);
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getDetails(): array
    {
        return $this->details;
    }
}
