<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

use DateTimeImmutable;
use Illuminate\Database\Capsule\Manager as Capsule;
use MelodyQuest\Api\Config;
use MelodyQuest\Api\Exceptions\ApiException;
use MelodyQuest\Api\Models\GamePlayer;
use MelodyQuest\Api\Models\Guess;
use MelodyQuest\Api\Models\Round;
use MelodyQuest\Api\Models\Score;
use MelodyQuest\Api\Models\TrackAnswer;
use MelodyQuest\Api\RedisBus;

class GuessService
{
    public function __construct(private RedisBus $bus)
    {
    }

    public function submitGuess(int $roundId, int $userId, string $guessText): array
    {
        $round = Round::with(['game', 'track'])->find($roundId);
        if (!$round) {
            throw new ApiException('Round not found', 404, 'ROUND_NOT_FOUND');
        }

        $game = $round->game;
        if (!$game) {
            throw new ApiException('Game not found for round', 404, 'GAME_NOT_FOUND');
        }

        $playerExists = GamePlayer::where('game_id', $game->id)
            ->where('user_id', $userId)
            ->exists();

        if (!$playerExists) {
            throw new ApiException('Player is not part of this game', 403, 'FORBIDDEN');
        }

        if ($game->status !== 'RUNNING') {
            throw new ApiException('Game is not running', 409, 'GAME_NOT_RUNNING');
        }

        if ($round->started_at === null) {
            throw new ApiException('Round has not started yet', 409, 'ROUND_NOT_STARTED');
        }

        if ($round->ended_at !== null || $round->winner_user_id !== null) {
            throw new ApiException('Round already ended', 409, 'ROUND_ENDED');
        }

        $guessText = trim($guessText);
        if ($guessText === '') {
            throw new ApiException('Guess text is required', 422, 'VALIDATION_ERROR');
        }

        $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');
        $basePoints = Config::pointsCorrectGuess();
        $firstBloodBonus = Config::bonusFirstBlood();
        $streakThreshold = Config::streakLength();
        $streakBonus = Config::streakBonus();

        $result = Capsule::connection()->transaction(function () use (
            $round,
            $userId,
            $guessText,
            $now,
            $basePoints,
            $firstBloodBonus,
            $streakThreshold,
            $streakBonus
        ) {
            $roundForUpdate = Round::where('id', $round->id)->lockForUpdate()->first();
            if (!$roundForUpdate) {
                throw new ApiException('Round not found', 404, 'ROUND_NOT_FOUND');
            }

            if ($roundForUpdate->ended_at !== null || $roundForUpdate->winner_user_id !== null) {
                throw new ApiException('Round already ended', 409, 'ROUND_ENDED');
            }

            $normalizedRow = Capsule::selectOne('SELECT fn_normalize(?) AS norm', [$guessText]);
            $normalized = (string) ($normalizedRow->norm ?? '');

            $answers = TrackAnswer::where('track_id', $roundForUpdate->track_id)
                ->get(['answer_text', 'normalized']);

            $hasExact = $answers->contains(function (TrackAnswer $answer) use ($normalized) {
                return $normalized !== '' && hash_equals((string) $answer->normalized, $normalized);
            });

            $answerTexts = $answers->pluck('answer_text')->all();
            $isCorrect = $hasExact || (!$hasExact && Fuzzy::isFuzzyMatch($guessText, $answerTexts));

            Guess::create([
                'round_id' => $roundForUpdate->id,
                'user_id' => $userId,
                'guess_text' => $guessText,
                'is_correct' => $isCorrect,
            ]);

            $roundSolvedEvent = null;
            $scoreUpdateEvent = null;

            if ($isCorrect) {
                $previousCorrectGuesses = Guess::query()
                    ->select('rounds.round_number')
                    ->join('rounds', 'rounds.id', '=', 'guesses.round_id')
                    ->where('rounds.game_id', $roundForUpdate->game_id)
                    ->where('rounds.round_number', '<', $roundForUpdate->round_number)
                    ->where('guesses.user_id', $userId)
                    ->where('guesses.is_correct', true)
                    ->orderByDesc('rounds.round_number')
                    ->get();

                $hasPreviousCorrect = $previousCorrectGuesses->isNotEmpty();
                $streakCount = 0;
                if ($previousCorrectGuesses->isNotEmpty()) {
                    $expectedRound = $roundForUpdate->round_number - 1;
                    foreach ($previousCorrectGuesses as $prevGuess) {
                        $prevRoundNumber = (int) $prevGuess->round_number;
                        if ($prevRoundNumber === $expectedRound) {
                            $streakCount++;
                            $expectedRound--;
                        } else {
                            break;
                        }
                    }
                }

                $pointsTotal = 0;
                if ($basePoints > 0) {
                    $pointsTotal += $basePoints;
                }

                if (!$hasPreviousCorrect && $firstBloodBonus > 0) {
                    $pointsTotal += $firstBloodBonus;
                }

                if (
                    $streakThreshold > 0
                    && ($streakCount + 1) >= $streakThreshold
                    && $streakBonus > 0
                ) {
                    $pointsTotal += $streakBonus;
                }

                $roundForUpdate->winner_user_id = $userId;
                $roundForUpdate->ended_at = $now;
                $roundForUpdate->reveal_video = true;
                $roundForUpdate->save();

                $score = Score::firstOrCreate([
                    'game_id' => $roundForUpdate->game_id,
                    'user_id' => $userId,
                ], [
                    'points' => 0,
                ]);
                if ($pointsTotal > 0) {
                    $score->increment('points', $pointsTotal);
                }

                $track = $round->track ?? $roundForUpdate->track()->first();

                $roundSolvedEvent = [
                    'type' => 'ROUND_SOLVED',
                    'round_id' => $roundForUpdate->id,
                    'winner_user_id' => $userId,
                    'track' => [
                        'id' => $track?->id,
                        'title' => $track?->title,
                        'youtube_video_id' => $track?->youtube_video_id,
                        'cover_image_url' => $track?->cover_image_url,
                    ],
                ];

                $scoresForEvent = Score::where('game_id', $roundForUpdate->game_id)
                    ->orderByDesc('points')
                    ->get(['user_id', 'points'])
                    ->map(static function (Score $scoreRow): array {
                        return [
                            'user_id' => (int) $scoreRow->user_id,
                            'points' => (int) $scoreRow->points,
                        ];
                    })
                    ->all();

                $scoreUpdateEvent = [
                    'type' => 'SCORE_UPDATE',
                    'scores' => $scoresForEvent,
                ];
            }

            return [
                'is_correct' => $isCorrect,
                'round_event' => $roundSolvedEvent,
                'score_event' => $scoreUpdateEvent,
            ];
        });

        if ($result['round_event'] !== null) {
            $this->bus->publish(RedisBus::channelGame($round->game_id), $result['round_event']);
        }

        if ($result['score_event'] !== null) {
            $this->bus->publish(RedisBus::channelGame($round->game_id), $result['score_event']);
        }

        return [
            'is_correct' => $result['is_correct'],
        ];
    }
}
