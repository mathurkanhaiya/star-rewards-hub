#!/bin/bash
set -e

echo "→ Building frontend..."
npm run build

echo "→ Building backend..."
./node_modules/.bin/esbuild server/index.ts \
  --bundle \
  --platform=node \
  --packages=external \
  --format=cjs \
  --outfile=dist/index.cjs

echo "✅ Build complete"
