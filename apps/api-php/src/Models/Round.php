<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Round extends Model
{
    protected $table = 'rounds';
    public $timestamps = false;
    protected $fillable = [
        'game_id',
        'round_number',
        'track_id',
        'started_at',
        'ended_at',
        'winner_user_id',
        'reveal_video',
    ];

    protected $casts = [
        'reveal_video' => 'boolean',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }

    public function winner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'winner_user_id');
    }

    public function guesses(): HasMany
    {
        return $this->hasMany(Guess::class);
    }
}
