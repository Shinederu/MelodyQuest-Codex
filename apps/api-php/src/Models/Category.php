<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $table = 'categories';
    public $timestamps = false;
    protected $fillable = ['name', 'is_active'];

    public function tracks(): HasMany
    {
        return $this->hasMany(Track::class);
    }

    public function games(): BelongsToMany
    {
        return $this->belongsToMany(Game::class, 'game_categories', 'category_id', 'game_id');
    }
}
