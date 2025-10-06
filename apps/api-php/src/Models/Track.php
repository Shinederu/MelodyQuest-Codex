<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Track extends Model
{
    protected $table = 'tracks';
    public $timestamps = false;
    protected $fillable = [
        'youtube_url',
        'youtube_video_id',
        'category_id',
        'title',
        'cover_image_url',
        'created_by',
    ];

    public function answers(): HasMany
    {
        return $this->hasMany(TrackAnswer::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
