<?php

declare(strict_types=1);

namespace MelodyQuest\Api\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class User extends Model
{
    protected $table = 'users';
    public $timestamps = false;
    protected $fillable = ['username'];

    public function tracksCreated(): HasMany
    {
        return $this->hasMany(Track::class, 'created_by');
    }

    public function hostedGames(): HasMany
    {
        return $this->hasMany(Game::class, 'host_user_id');
    }
}
