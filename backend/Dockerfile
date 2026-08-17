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

# ---- Node 22 (for Browsershot's puppeteer bridge) ---------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
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

# GitHub's archive API is prone to transient 504s under parallel load, so keep
# downloads serial and, after a few dist attempts, fall back to git clones
# (a separate, more reliable path) before giving up.
ENV COMPOSER_MAX_PARALLEL_HTTP=1
RUN set -eu; \
    ok=0; \
    for i in 1 2 3 4 5 6; do \
      if [ "$i" -le 4 ]; then pref=--prefer-dist; else pref=--prefer-source; fi; \
      if composer install --no-dev --optimize-autoloader --no-interaction $pref; then \
        ok=1; break; \
      fi; \
      echo "composer install attempt $i ($pref) failed; retrying in 20s..."; \
      sleep 20; \
    done; \
    [ "$ok" = "1" ] || { echo "composer install failed after retries"; exit 1; }; \
    npm install --omit=dev

# Render supplies the port to listen on in $PORT.
CMD sh -c "php artisan config:clear \
  && php artisan migrate --database=landlord --path=database/migrations/landlord --force \
  && (php artisan storage:link || true) \
  && php artisan serve --host 0.0.0.0 --port ${PORT:-8000}"
