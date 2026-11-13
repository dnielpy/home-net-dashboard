#!/bin/sh
# Updates a production deployment: stops the containers, pulls the latest code and starts everything again.
# Usage, from anywhere: ./scripts/update.sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
    echo "Missing .env.production (copy .env.production.example and fill it in)" >&2
    exit 1
fi

compose() {
    docker compose -f docker-compose.prod.yml --env-file .env.production "$@"
}

echo "==> Stopping containers"
compose down

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
compose up -d --build --wait --remove-orphans

compose ps
