<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Services;

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;
use InvalidArgumentException;
use MelodyQuest\Api\Helpers\YouTube;
use MelodyQuest\Api\Models\Track;
use MelodyQuest\Api\Models\TrackAnswer;

class TrackService
{
    public function addTrack(array $payload): Track
    {
        if (!isset($payload['youtube_url'], $payload['category_id'])) {
            throw new InvalidArgumentException('Missing required track fields');
        }

        $videoId = YouTube::extractVideoId((string) $payload['youtube_url']);
        $answers = array_map('strval', $payload['answers'] ?? []);

        return Capsule::connection()->transaction(function () use ($payload, $videoId, $answers) {
            $track = Track::create([
                'youtube_url' => $payload['youtube_url'],
                'youtube_video_id' => $videoId,
                'category_id' => (int) $payload['category_id'],
                'title' => $payload['title'] ?? null,
                'cover_image_url' => $payload['cover_image_url'] ?? null,
                'created_by' => $payload['created_by'] ?? null,
            ]);

            $uniqueAnswers = [];
            foreach ($answers as $answer) {
                $trimmed = trim($answer);
                if ($trimmed === '') {
                    continue;
                }
                $key = mb_strtolower($trimmed);
                $uniqueAnswers[$key] = $trimmed;
            }

            foreach ($uniqueAnswers as $answer) {
                try {
                    TrackAnswer::create([
                        'track_id' => $track->id,
                        'answer_text' => $answer,
                    ]);
                } catch (QueryException $exception) {
                    if (str_contains(strtolower($exception->getMessage()), 'uq_track_answers')) {
                        continue;
                    }

                    throw $exception;
                }
            }

            return $track->load('answers');
        });
    }

    public function addAnswers(Track $track, array $answers): Track
    {
        return Capsule::connection()->transaction(function () use ($track, $answers) {
            $uniqueAnswers = [];
            foreach ($answers as $answer) {
                $trimmed = trim((string) $answer);
                if ($trimmed === '') {
                    continue;
                }
                $key = mb_strtolower($trimmed);
                $uniqueAnswers[$key] = $trimmed;
            }

            foreach ($uniqueAnswers as $answer) {
                try {
                    TrackAnswer::create([
                        'track_id' => $track->id,
                        'answer_text' => $answer,
                    ]);
                } catch (QueryException $exception) {
                    if (str_contains(strtolower($exception->getMessage()), 'uq_track_answers')) {
                        continue;
                    }

                    throw $exception;
                }
            }

            return $track->load('answers');
        });
    }

    public function searchTracks(?int $categoryId, ?string $query): Collection
    {
        $builder = Track::query()->with(['answers', 'category']);

        if ($categoryId !== null) {
            $builder->where('category_id', $categoryId);
        }

        if ($query !== null && $query !== '') {
            $pattern = '%' . $query . '%';
            $builder->where(function ($q) use ($pattern) {
                $q->where('title', 'like', $pattern)
                    ->orWhere('youtube_url', 'like', $pattern);
            });
        }

        return $builder->orderByDesc('id')->limit(50)->get();
    }
}
