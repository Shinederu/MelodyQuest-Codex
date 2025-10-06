<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

use DateTimeImmutable;
use Illuminate\Database\Capsule\Manager as Capsule;
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

        if ($round->ended_at !== null) {
            throw new ApiException('Round already ended', 409, 'ROUND_ENDED');
        }

        $guessText = trim($guessText);
        if ($guessText === '') {
            throw new ApiException('Guess text is required', 422, 'VALIDATION_ERROR');
        }

        $now = (new DateTimeImmutable())->format('Y-m-d H:i:s');
        $result = Capsule::connection()->transaction(function () use ($round, $userId, $guessText, $now) {
            $normalizedRow = Capsule::selectOne('SELECT fn_normalize(?) AS norm', [$guessText]);
            $normalized = $normalizedRow->norm ?? '';

            $isCorrect = TrackAnswer::where('track_id', $round->track_id)
                ->whereRaw('normalized = ?', [$normalized])
                ->exists();

            Guess::create([
                'round_id' => $round->id,
                'user_id' => $userId,
                'guess_text' => $guessText,
                'is_correct' => $isCorrect,
            ]);

            $event = null;
            if ($isCorrect && $round->winner_user_id === null) {
                $round->winner_user_id = $userId;
                $round->ended_at = $now;
                $round->reveal_video = true;
                $round->save();

                $score = Score::firstOrCreate([
                    'game_id' => $round->game_id,
                    'user_id' => $userId,
                ], [
                    'points' => 0,
                ]);
                $score->increment('points');

                $event = [
                    'type' => 'ROUND_SOLVED',
                    'round_id' => $round->id,
                    'winner_user_id' => $userId,
                    'track' => [
                        'id' => $round->track->id,
                        'title' => $round->track->title,
                        'youtube_video_id' => $round->track->youtube_video_id,
                        'cover_image_url' => $round->track->cover_image_url,
                    ],
                ];
            }

            return [
                'is_correct' => $isCorrect,
                'event' => $event,
            ];
        });

        if ($result['event'] !== null) {
            $this->bus->publish(RedisBus::channelGame($round->game_id), $result['event']);
        }

        return [
            'is_correct' => $result['is_correct'],
        ];
    }
}
