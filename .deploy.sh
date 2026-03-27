#!/bin/bash
set -e    # exit immediately if any command fails

echo "→ Pulling latest code..."
git pull origin main

echo "→ Installing dependencies..."
npm ci --omit=dev

echo "→ Building..."
npm run build

echo "→ Reloading PM2 (zero downtime)..."
pm2 reload ecosystem.config.js 

echo "✓ Deploy complete"