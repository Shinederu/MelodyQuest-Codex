<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    protected $table = 'games';
    public $timestamps = false;
    protected $fillable = [
        'host_user_id',
        'status',
        'round_count',
        'created_at',
        'started_at',
        'ended_at',
    ];

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Round::class);
    }

    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'game_categories', 'game_id', 'category_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(Score::class);
    }
}
