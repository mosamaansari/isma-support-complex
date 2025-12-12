# Environment Variables Setup Guide

## Quick Start

1. **Copy the example file:**
   ```bash
   cd backend
   copy .env.example .env
   ```
   Or on Linux/Mac:
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your actual values**

## Required Configuration

### 1. Database (PostgreSQL)

Update `DATABASE_URL` with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public"
```

**Example:**
```env
# Default PostgreSQL installation
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/isma_sports_complex?schema=public"

# Custom PostgreSQL
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/isma_sports_complex?schema=public"
```

**How to find your PostgreSQL credentials:**
- Username: Usually `postgres` (default)
- Password: The password you set during PostgreSQL installation
- Port: Usually `5432` (default)
- Database: `isma_sports_complex` (create it first)

**Create Database:**
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE isma_sports_complex;

-- Exit
\q
```

### 2. Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

If Redis is running on a different port or requires password:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### 3. JWT Secret (IMPORTANT!)

**Generate a secure secret:**
```bash
# Using OpenSSL
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Update in .env:**
```env
JWT_SECRET=your-generated-secret-key-here-minimum-32-characters
JWT_EXPIRE=7d
```

### 4. CORS Origin

Update to match your frontend URL:

```env
# Development
CORS_ORIGIN=http://localhost:5173

# Production
CORS_ORIGIN=https://yourdomain.com
```

## Complete .env Example

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/isma_sports_complex?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-change-in-production
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

## Verification

After setting up `.env`, verify the configuration:

```bash
# Check if .env is loaded correctly
npm run dev

# Should see:
# Server running on port 5000
# Redis connected successfully
# Database connected
```

## Security Notes

1. **Never commit `.env` to Git** (already in `.gitignore`)
2. **Use strong passwords** in production
3. **Change JWT_SECRET** to a random string
4. **Use environment-specific values** for production
5. **Restrict CORS_ORIGIN** to your actual domain in production

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify username/password in DATABASE_URL
- Ensure database exists: `CREATE DATABASE isma_sports_complex;`

### Redis Connection Error
- Check Redis is running: `redis-cli ping`
- Verify REDIS_HOST and REDIS_PORT
- Check firewall settings

### Port Already in Use
- Change PORT in .env to a different port (e.g., 5001)
- Or kill the process using port 5000

