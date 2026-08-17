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

# GitHub's archive API occasionally returns transient 5xx errors, so retry a
# few times before giving up rather than failing the whole build on one blip.
ENV COMPOSER_MAX_PARALLEL_HTTP=6
RUN set -eu; \
    success=0; \
    for i in 1 2 3 4 5; do \
      if composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist; then \
        success=1; break; \
      fi; \
      echo "composer install attempt $i failed; retrying in 15s..."; \
      sleep 15; \
    done; \
    [ "$success" = "1" ] || { echo "composer install failed after 5 attempts"; exit 1; }; \
    npm install --omit=dev

# Render supplies the port to listen on in $PORT.
CMD sh -c "php artisan config:clear \
  && php artisan migrate --database=landlord --path=database/migrations/landlord --force \
  && (php artisan storage:link || true) \
  && php artisan serve --host 0.0.0.0 --port ${PORT:-8000}"
