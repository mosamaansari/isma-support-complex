#!/bin/bash

# Database Setup Script for Vercel/Prisma

echo "🚀 Setting up database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not found. Please set it in your environment or .env file"
    echo ""
    echo "Create a .env file with:"
    echo 'DATABASE_URL="postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require"'
    exit 1
fi

echo "✅ DATABASE_URL found"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Deploy migrations
echo "🗄️  Deploying database migrations..."
npx prisma migrate deploy

echo "✅ Database setup complete!"
echo ""
echo "You can now:"
echo "  - View database: npx prisma studio"
echo "  - Check status: npx prisma migrate status"














