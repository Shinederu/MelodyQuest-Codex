<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

class Fuzzy
{
    /**
     * @param string   $guess
     * @param string[] $answers
     */
    public static function isFuzzyMatch(string $guess, array $answers): bool
    {
        $normalizedGuess = TextNormalizer::normalizeForFuzzy($guess);
        if ($normalizedGuess === '') {
            return false;
        }

        foreach ($answers as $answer) {
            $normalizedAnswer = TextNormalizer::normalizeForFuzzy($answer);
            if ($normalizedAnswer === '') {
                continue;
            }

            $distance = levenshtein($normalizedGuess, $normalizedAnswer);
            $threshold = max(2, (int) floor(strlen($normalizedAnswer) / 5));

            if ($distance <= $threshold) {
                return true;
            }
        }

        return false;
    }
}
