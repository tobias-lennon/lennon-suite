#!/bin/bash
# deploy.sh — runs on the server after every git pull
set -e

echo ""
echo "=============================="
echo " Lennon Suite — Deploying"
echo "=============================="
echo ""

echo "[1/4] Installing PHP dependencies..."
cd backend
composer install --no-dev --optimize-autoloader --quiet

echo "[2/4] Running database migrations..."
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan optimize

echo "[3/4] Building frontend..."
cd ../frontend
npm ci --silent
npm run build

echo "[4/4] Done."
echo ""
echo "Suite deployed."
echo ""
