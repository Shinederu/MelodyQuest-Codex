<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

use voku\helper\ASCII as PortableAscii;

class TextNormalizer
{
    public static function normalizeForFuzzy(string $s): string
    {
        $s = PortableAscii::to_ascii(mb_strtolower($s, 'UTF-8'));
        $s = preg_replace('/[^a-z0-9 ]+/u', ' ', $s) ?? '';
        $s = preg_replace('/\s+/u', ' ', $s) ?? '';

        return trim($s);
    }
}
