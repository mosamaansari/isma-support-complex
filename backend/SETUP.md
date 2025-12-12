# Backend Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher)
3. **Redis** (v6 or higher)

## Step-by-Step Setup

### 1. Install PostgreSQL

**Windows:**
- Download from https://www.postgresql.org/download/windows/
- Install and set password for `postgres` user (default: `postgres`)

**Linux:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres psql
```

**Mac:**
```bash
brew install postgresql
brew services start postgresql
```

### 2. Create Database

```sql
CREATE DATABASE isma_sports_complex;
```

Or via command line:
```bash
createdb isma_sports_complex
```

### 3. Install Redis

**Windows:**
- Download from https://github.com/microsoftarchive/redis/releases
- Or use WSL: `wsl redis-server`

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Mac:**
```bash
brew install redis
brew services start redis
```

### 4. Update .env File

Copy `.env.example` to `.env` and update:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/isma_sports_complex?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-key-change-this
```

### 5. Install Dependencies

```bash
cd backend
npm install
```

### 6. Setup Prisma

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (creates all tables)
npm run prisma:migrate

# Seed database (creates default users)
npm run prisma:seed
```

### 7. Start Development Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

## Verify Setup

1. Check health endpoint: `http://localhost:5000/health`
2. Should return:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "..."
}
```

## Default Users

After seeding:
- **SuperAdmin**: `superadmin` / `superadmin123`
- **Admin**: `admin` / `admin123`

## Troubleshooting

### Database Connection Error
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Check username/password

### Redis Connection Error
- Check Redis is running: `redis-cli ping` (should return PONG)
- Verify REDIS_HOST and REDIS_PORT in .env

### Port Already in Use
- Change PORT in .env file
- Or kill process using port 5000

