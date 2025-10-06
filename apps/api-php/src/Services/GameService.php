<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

use DateTimeImmutable;
use Illuminate\Database\Capsule\Manager as Capsule;
use MelodyQuest\Api\Exceptions\ApiException;
use MelodyQuest\Api\RedisBus;
use MelodyQuest\Api\Models\Game;
use MelodyQuest\Api\Models\GameCategory;
use MelodyQuest\Api\Models\GamePlayer;
use MelodyQuest\Api\Models\Round;
use MelodyQuest\Api\Models\Track;
use MelodyQuest\Api\Models\User;

class GameService
{
    public function __construct(private RedisBus $bus)
    {
    }

    public function createGame(int $hostUserId, int $roundCount, array $categoryIds): Game
    {
        return Capsule::connection()->transaction(function () use ($hostUserId, $roundCount, $categoryIds) {
            $host = User::find($hostUserId);
            if (!$host) {
                throw new ApiException('Host user not found', 404, 'HOST_NOT_FOUND');
            }

            $game = Game::create([
                'host_user_id' => $hostUserId,
                'round_count' => $roundCount,
                'status' => 'LOBBY',
            ]);

            $uniqueCategories = array_values(array_unique(array_map('intval', $categoryIds)));
            foreach ($uniqueCategories as $categoryId) {
                GameCategory::create([
                    'game_id' => $game->id,
                    'category_id' => $categoryId,
                ]);
            }

            GamePlayer::firstOrCreate([
                'game_id' => $game->id,
                'user_id' => $hostUserId,
            ]);

            return $game->load(['categories', 'players.user']);
        });
    }

    /**
     * @return array{player: GamePlayer, created: bool}
     */
    public function addPlayer(int $gameId, int $userId): array
    {
        return Capsule::connection()->transaction(function () use ($gameId, $userId) {
            $game = Game::find($gameId);
            if (!$game) {
                throw new ApiException('Game not found', 404, 'GAME_NOT_FOUND');
            }

            $user = User::find($userId);
            if (!$user) {
                throw new ApiException('User not found', 404, 'USER_NOT_FOUND');
            }

            $player = GamePlayer::firstOrCreate([
                'game_id' => $game->id,
                'user_id' => $user->id,
            ]);

            $created = $player->wasRecentlyCreated;

            if ($created) {
                $this->bus->publish(
                    RedisBus::channelGame($game->id),
                    [
                        'type' => 'PLAYER_JOINED',
                        'user_id' => $player->user_id,
                    ]
                );
            }

            return [
                'player' => $player->load('user'),
                'created' => $created,
            ];
        });
    }

    public function startGame(int $gameId, int $initiatorId): Round
    {
        return Capsule::connection()->transaction(function () use ($gameId, $initiatorId) {
            /** @var Game|null $game */
            $game = Game::with(['categories'])->lockForUpdate()->find($gameId);
            if (!$game) {
                throw new ApiException('Game not found', 404, 'GAME_NOT_FOUND');
            }

            if ($game->host_user_id !== $initiatorId) {
                throw new ApiException('Only the host can start the game', 403, 'FORBIDDEN');
            }

            if ($game->status !== 'LOBBY') {
                throw new ApiException('Game already started', 409, 'GAME_ALREADY_STARTED');
            }

            $categoryIds = $game->categories->pluck('id')->all();
            if ($categoryIds === []) {
                throw new ApiException('No categories configured for this game', 400, 'NO_CATEGORIES');
            }

            $tracks = Track::query()
                ->whereIn('category_id', $categoryIds)
                ->inRandomOrder()
                ->limit($game->round_count)
                ->get();

            if ($tracks->count() < $game->round_count) {
                throw new ApiException('Not enough tracks to start the game', 400, 'NOT_ENOUGH_TRACKS');
            }

            Round::where('game_id', $game->id)->delete();

            $rounds = [];
            $roundNumber = 1;
            foreach ($tracks as $track) {
                $rounds[] = Round::create([
                    'game_id' => $game->id,
                    'round_number' => $roundNumber++,
                    'track_id' => $track->id,
                ]);
            }

            $firstRound = $rounds[0];
            $firstRound->started_at = (new DateTimeImmutable())->format('Y-m-d H:i:s');
            $firstRound->save();

            $game->status = 'RUNNING';
            $game->started_at = (new DateTimeImmutable())->format('Y-m-d H:i:s');
            $game->save();

            $this->bus->publish(
                RedisBus::channelGame($game->id),
                [
                    'type' => 'ROUND_START',
                    'round_id' => $firstRound->id,
                    'track_id' => $firstRound->track_id,
                ]
            );

            return $firstRound->load('track');
        });
    }

    public function nextRound(int $gameId, int $userId): Round
    {
        return Capsule::connection()->transaction(function () use ($gameId, $userId) {
            /** @var Game|null $game */
            $game = Game::with(['rounds' => function ($query) {
                $query->orderBy('round_number');
            }])->lockForUpdate()->find($gameId);

            if (!$game) {
                throw new ApiException('Game not found', 404, 'GAME_NOT_FOUND');
            }

            if ($game->host_user_id !== $userId) {
                throw new ApiException('Only the host can advance the game', 403, 'FORBIDDEN');
            }

            $nextRound = $game->rounds->first(function (Round $round) {
                return $round->started_at === null;
            });

            if (!$nextRound) {
                throw new ApiException('No more rounds to start', 400, 'NO_ROUNDS');
            }

            $nextRound->started_at = (new DateTimeImmutable())->format('Y-m-d H:i:s');
            $nextRound->reveal_video = false;
            $nextRound->winner_user_id = null;
            $nextRound->ended_at = null;
            $nextRound->save();

            $this->bus->publish(
                RedisBus::channelGame($game->id),
                [
                    'type' => 'ROUND_START',
                    'round_id' => $nextRound->id,
                    'track_id' => $nextRound->track_id,
                ]
            );

            return $nextRound->load('track');
        });
    }

    public function getState(int $gameId): array
    {
        $game = Game::with([
            'players.user',
            'rounds' => function ($query) {
                $query->orderBy('round_number');
            },
            'scores' => function ($query) {
                $query->orderByDesc('points');
            },
            'categories',
        ])->find($gameId);

        if (!$game) {
            throw new ApiException('Game not found', 404, 'GAME_NOT_FOUND');
        }

        $currentRound = $game->rounds->first(function (Round $round) {
            return $round->started_at !== null && $round->ended_at === null;
        });

        if (!$currentRound) {
            $currentRound = $game->rounds->first(function (Round $round) {
                return $round->started_at === null;
            });
        }

        $scores = $game->scores->load('user');

        return [
            'game' => $game->toArray(),
            'players' => $game->players->map(fn ($player) => $player->toArray())->all(),
            'currentRound' => $currentRound?->load('track')->toArray(),
            'scores' => $scores->map(fn ($score) => $score->toArray())->all(),
            'rules' => [
                'round_count' => $game->round_count,
            ],
        ];
    }
}
