# Redis Setup Guide for Windows

## Option 1: Using WSL (Windows Subsystem for Linux) - Recommended

### Install WSL (if not already installed)
```bash
wsl --install
```

### Install Redis in WSL
```bash
wsl
sudo apt-get update
sudo apt-get install redis-server
```

### Start Redis in WSL
```bash
wsl redis-server
```

Or run in background:
```bash
wsl redis-server --daemonize yes
```

### Test Redis Connection
```bash
wsl redis-cli ping
# Should return: PONG
```

## Option 2: Using Memurai (Windows Native Redis Alternative)

1. Download from: https://www.memurai.com/get-memurai
2. Install Memurai (it's Redis-compatible)
3. It will start automatically as a Windows service
4. Use default port: 6379

## Option 3: Using Docker

### Install Docker Desktop
1. Download from: https://www.docker.com/products/docker-desktop
2. Install and start Docker Desktop

### Run Redis Container
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### Check if Redis is Running
```bash
docker ps
```

### Stop Redis
```bash
docker stop redis
```

### Start Redis Again
```bash
docker start redis
```

## Option 4: Using Chocolatey (Package Manager)

```bash
# Install Chocolatey first (if not installed)
# Then install Redis
choco install redis-64 -y

# Start Redis
redis-server
```

## Verify Redis Installation

After starting Redis, test the connection:

```bash
# Using redis-cli
redis-cli ping
# Should return: PONG

# Or test from Node.js
node -e "const Redis = require('ioredis'); const r = new Redis(); r.ping().then(console.log);"
```

## Redis Configuration for Backend

Once Redis is running, update your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

If Redis requires a password (production), set:
```env
REDIS_PASSWORD=your_redis_password
```

## Troubleshooting

### Port 6379 Already in Use
```bash
# Find process using port 6379
netstat -ano | findstr :6379

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Redis Not Starting
- Check if Redis is already running: `redis-cli ping`
- Check Windows Firewall settings
- Try using a different port in `.env`: `REDIS_PORT=6380`

## Recommended Setup for Development

For Windows development, I recommend:
1. **WSL + Redis** (best compatibility)
2. **Docker** (easy to manage)
3. **Memurai** (Windows native, easiest)

Choose the option that works best for your setup!

