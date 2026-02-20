#!/bin/bash
set -e

echo "🗑️  Removing cached Prisma binaries..."
rm -rf /app/node_modules/.prisma || true
rm -rf /app/node_modules/@prisma/client || true

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Running database migrations..."
npx prisma db push --accept-data-loss || echo "⚠️  Migration warning (non-critical)"

echo "🚀 Starting application..."
exec node dist/main.js
