#!/bin/bash
# Quick start script for local development

set -e

echo "🚀 NostrMaxi Quick Start (Development)"
echo "======================================"

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created - please edit it with your configuration"
    echo ""
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Start database
echo "🗄️  Starting database..."
docker-compose up -d db

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev

# Seed database (optional)
if [ -f "prisma/seed.ts" ]; then
    echo "🌱 Seeding database..."
    npx prisma db seed
fi

# Start services
echo "🚀 Starting development servers..."
echo ""
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "API Docs: http://localhost:3000/api/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev
