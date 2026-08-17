# Laravel API image for Render.
# Includes the PostgreSQL driver, Node 20 and Chromium, which the PDF report
# (spatie/browsershot + puppeteer) needs to render.

FROM php:8.3-cli-bookworm

# ---- System packages and PHP extensions -------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      git unzip curl ca-certificates gnupg \
      libpq-dev libzip-dev libonig-dev \
      chromium fonts-liberation \
  && docker-php-ext-install pdo_pgsql pgsql zip \
  && rm -rf /var/lib/apt/lists/*

# ---- Node 20 (for Browsershot's puppeteer bridge) ---------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

# ---- Composer ---------------------------------------------------------------
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . /app

# Use the Chromium installed above rather than downloading another copy
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium \
    APP_ENV=production \
    APP_DEBUG=false

RUN composer install --no-dev --optimize-autoloader --no-interaction \
  && npm install --omit=dev

# Render supplies the port to listen on in $PORT.
CMD sh -c "php artisan config:clear \
  && php artisan migrate --database=landlord --path=database/migrations/landlord --force \
  && (php artisan storage:link || true) \
  && php artisan serve --host 0.0.0.0 --port ${PORT:-8000}"
