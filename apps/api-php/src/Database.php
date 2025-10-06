<?php

declare(strict_types=1);

namespace MelodyQuest\Api;

use Illuminate\Database\Capsule\Manager as Capsule;

class Database
{
    private static ?Capsule $capsule = null;

    public static function boot(): Capsule
    {
        if (self::$capsule !== null) {
            return self::$capsule;
        }

        $capsule = new Capsule();
        $capsule->addConnection([
            'driver' => 'mysql',
            'host' => Config::env('DB_HOST', 'mysql'),
            'port' => Config::envInt('DB_PORT', 3306),
            'database' => Config::env('DB_DATABASE', 'melodyquest'),
            'username' => Config::env('DB_USERNAME', 'root'),
            'password' => Config::env('DB_PASSWORD', 'secret'),
            'charset' => 'utf16',
            'collation' => 'utf16_general_ci',
            'prefix' => '',
        ]);

        $capsule->setAsGlobal();
        $capsule->bootEloquent();

        return self::$capsule = $capsule;
    }
}
