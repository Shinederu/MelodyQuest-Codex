<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrackAnswer extends Model
{
    protected $table = 'track_answers';
    public $timestamps = false;
    protected $fillable = ['track_id', 'answer_text'];

    public function track(): BelongsTo
    {
        return $this->belongsTo(Track::class);
    }
}
