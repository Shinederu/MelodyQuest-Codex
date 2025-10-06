<?php

declare(strict_types=1);

namespace MelodyQuest\Api;

use Dotenv\Dotenv;

class Config
{
    private static bool $loaded = false;

    public static function load(?string $basePath = null): void
    {
        if (self::$loaded) {
            return;
        }

        $paths = array_unique(array_filter([
            $basePath,
            dirname(__DIR__, 3),
            dirname(__DIR__, 2),
            dirname(__DIR__),
        ]));

        foreach ($paths as $path) {
            if (!is_dir($path)) {
                continue;
            }

            $envFile = $path . DIRECTORY_SEPARATOR . '.env';
            if (is_file($envFile)) {
                Dotenv::createImmutable($path)->safeLoad();
            }
        }

        self::$loaded = true;
    }

    public static function env(string $key, mixed $default = null): mixed
    {
        return $_ENV[$key] ?? $_SERVER[$key] ?? $default;
    }

    public static function envInt(string $key, int $default): int
    {
        return (int) (self::env($key, $default));
    }

    public static function envBool(string $key, bool $default = false): bool
    {
        $value = self::env($key);
        if ($value === null) {
            return $default;
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
    }

    public static function allowedOrigins(): array
    {
        $origins = self::env('ALLOWED_ORIGINS', '*');
        if ($origins === '*') {
            return ['*'];
        }

        return self::splitCsv((string) $origins);
    }

    public static function isDevelopment(): bool
    {
        return strtolower((string) self::env('APP_ENV', 'production')) === 'development';
    }

    public static function adminToken(): string
    {
        return (string) self::env('ADMIN_TOKEN', 'changeme');
    }

    public static function rateLimitPerMinute(): int
    {
        return self::envInt('RATE_LIMIT_PER_MIN', 60);
    }

    /**
     * @return array<int, string>
     */
    public static function rateLimitWhitelist(): array
    {
        $value = (string) self::env('RATE_LIMIT_WHITELIST', '');

        return self::splitCsv($value);
    }

    public static function pointsCorrectGuess(): int
    {
        return self::envInt('POINTS_CORRECT_GUESS', 1);
    }

    public static function bonusFirstBlood(): int
    {
        return max(0, self::envInt('BONUS_FIRST_BLOOD', 1));
    }

    public static function streakLength(): int
    {
        return max(0, self::envInt('STREAK_N', 3));
    }

    public static function streakBonus(): int
    {
        return max(0, self::envInt('STREAK_BONUS', 1));
    }

    public static function realtimeHmacSecret(): string
    {
        return (string) self::env('REALTIME_HMAC_SECRET', 'change-me');
    }

    /**
     * @return array<int, string>
     */
    private static function splitCsv(string $value): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $value))));
    }
}
