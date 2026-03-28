#!/bin/bash
set -e    # exit immediately if any command fails

echo "→ Pulling latest code..."
git pull origin dev

echo "→ Installing dependencies..."
npm install

echo "→ Building..."
npm run build

echo "→ Reloading PM2 (zero downtime)..."
pm2 reload ecosystem.config.js 

echo "✓ Deploy complete"