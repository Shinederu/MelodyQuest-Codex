<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

/** @var \Slim\App $app */
$app = require __DIR__ . '/../bootstrap/app.php';
$app->run();
