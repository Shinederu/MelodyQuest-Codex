<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameCategory extends Model
{
    protected $table = 'game_categories';
    public $timestamps = false;
    protected $fillable = ['game_id', 'category_id'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }
}
