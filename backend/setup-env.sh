#!/bin/bash

# Setup .env file from .env.example
# This script will create .env file if it doesn't exist

if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cat > .env << 'EOF'
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
# IMPORTANT: Update with your PostgreSQL credentials
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/isma_sports_complex?schema=public"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
# IMPORTANT: Change this to a strong random string in production!
JWT_SECRET=isma-sports-complex-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
EOF
    echo "✅ .env file created successfully!"
    echo ""
    echo "⚠️  IMPORTANT: Please update the following in .env file:"
    echo "   1. DATABASE_URL - Update with your PostgreSQL password"
    echo "   2. JWT_SECRET - Change to a strong random string"
    echo ""
else
    echo "⚠️  .env file already exists. Skipping creation."
    echo "   If you want to recreate it, delete .env first and run this script again."
fi

