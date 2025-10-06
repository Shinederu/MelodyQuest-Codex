<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Helpers;

use InvalidArgumentException;

class YouTube
{
    public static function extractVideoId(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            throw new InvalidArgumentException('YouTube URL is required');
        }

        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $url) === 1) {
            return $url;
        }

        $parsed = parse_url($url);
        if ($parsed === false || !isset($parsed['host'])) {
            throw new InvalidArgumentException('Invalid YouTube URL');
        }

        $host = strtolower($parsed['host']);
        $path = $parsed['path'] ?? '';

        if (str_contains($host, 'youtu.be')) {
            $segments = array_values(array_filter(explode('/', $path)));
            $candidate = $segments[0] ?? '';
        } elseif (str_contains($host, 'youtube.com')) {
            if (str_starts_with($path, '/watch')) {
                parse_str($parsed['query'] ?? '', $query);
                $candidate = $query['v'] ?? '';
            } else {
                $segments = array_values(array_filter(explode('/', $path)));
                $candidate = $segments[1] ?? '';
                if (($segments[0] ?? '') === 'embed' || ($segments[0] ?? '') === 'shorts') {
                    $candidate = $segments[1] ?? '';
                } elseif (($segments[0] ?? '') === 'v') {
                    $candidate = $segments[1] ?? '';
                }
            }
        } else {
            throw new InvalidArgumentException('Unsupported YouTube host');
        }

        $candidate = trim($candidate ?? '');
        if (preg_match('/^[A-Za-z0-9_-]{11}$/', $candidate) !== 1) {
            throw new InvalidArgumentException('Unable to extract YouTube video id');
        }

        return $candidate;
    }
}
