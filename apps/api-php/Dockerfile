FROM php:8.3-fpm-alpine

RUN apk add --no-cache \
    icu-dev \
    libzip-dev \
    oniguruma-dev \
    git \
    unzip \
    curl \
    bash \
    mysql-client \
    $PHPIZE_DEPS \
 && docker-php-ext-install pdo_mysql intl mbstring \
 && apk del $PHPIZE_DEPS

WORKDIR /var/www/api

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json composer.lock* ./
RUN composer install --no-dev --prefer-dist --no-interaction

COPY . .

RUN composer dump-autoload --optimize

CMD ["php-fpm"]
