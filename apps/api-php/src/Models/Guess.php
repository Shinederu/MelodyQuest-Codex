<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guess extends Model
{
    protected $table = 'guesses';
    public $timestamps = false;
    protected $fillable = ['round_id', 'user_id', 'guess_text', 'is_correct'];
    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
