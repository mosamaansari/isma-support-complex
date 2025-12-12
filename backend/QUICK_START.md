# Quick Start Guide

## Step 1: Install Redis

### For Windows (Choose one method):

**Option A: Using WSL (Recommended)**
```bash
# Install WSL if not installed
wsl --install

# In WSL terminal
wsl
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
wsl redis-server
```

**Option B: Using Docker**
```bash
# Install Docker Desktop first, then:
docker run -d -p 6379:6379 --name redis redis:latest
```

**Option C: Using Memurai (Windows Native)**
- Download: https://www.memurai.com/get-memurai
- Install and it will run as Windows service

**Option D: Using Chocolatey**
```bash
choco install redis-64 -y
redis-server
```

### Verify Redis is Running
```bash
# Test connection
redis-cli ping
# Should return: PONG
```

## Step 2: Setup PostgreSQL Database

### Create Database
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE isma_sports_complex;

-- Exit
\q
```

## Step 3: Setup Environment Variables

### Create .env File

**Windows:**
```bash
cd backend
setup-env.bat
```

**Linux/Mac:**
```bash
cd backend
bash setup-env.sh
```

**Or manually:**
```bash
# Copy example file
cp .env.example .env
```

### Update .env File

Open `.env` and update these values:

1. **DATABASE_URL** - Update PostgreSQL password:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/isma_sports_complex?schema=public"
   ```

2. **JWT_SECRET** - Generate a secure secret:
   ```bash
   # Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Then update in `.env`:
   ```env
   JWT_SECRET=your-generated-secret-here
   ```

## Step 4: Install Dependencies & Setup Database

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database (creates default users)
npm run prisma:seed
```

## Step 5: Start Backend Server

```bash
npm run dev
```

Server will run on `http://localhost:5000`

## Step 6: Verify Setup

### Test Health Endpoint
Open browser or use curl:
```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "..."
}
```

## Default Users

After seeding, you can login with:
- **SuperAdmin**: `superadmin` / `superadmin123`
- **Admin**: `admin` / `admin123`

## Troubleshooting

### Redis Connection Error
- Make sure Redis is running: `redis-cli ping`
- Check REDIS_HOST and REDIS_PORT in .env

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in .env
- Ensure database exists: `CREATE DATABASE isma_sports_complex;`

### Port Already in Use
- Change PORT in .env to a different port (e.g., 5001)

## Next Steps

1. ✅ Redis installed and running
2. ✅ PostgreSQL database created
3. ✅ .env file configured
4. ✅ Dependencies installed
5. ✅ Database migrated and seeded
6. ✅ Server running

Now you can connect your frontend to the backend API!

