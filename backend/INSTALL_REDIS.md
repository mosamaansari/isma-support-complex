# Redis Installation Guide for Windows

## Method 1: Using WSL (Windows Subsystem for Linux) - ⭐ Recommended

### Step 1: Install WSL
```bash
# Open PowerShell as Administrator
wsl --install
```

Restart your computer after installation.

### Step 2: Install Redis in WSL
```bash
# Open WSL terminal
wsl

# Update package list
sudo apt-get update

# Install Redis
sudo apt-get install redis-server -y
```

### Step 3: Start Redis
```bash
# Start Redis server
wsl redis-server
```

**To run Redis in background:**
```bash
wsl redis-server --daemonize yes
```

### Step 4: Verify Installation
```bash
# Test Redis connection
wsl redis-cli ping
# Should return: PONG
```

**To stop Redis:**
```bash
wsl redis-cli shutdown
```

---

## Method 2: Using Docker - 🐳 Easy Option

### Step 1: Install Docker Desktop
1. Download: https://www.docker.com/products/docker-desktop
2. Install Docker Desktop
3. Start Docker Desktop

### Step 2: Run Redis Container
```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Or with persistent storage
docker run -d -p 6379:6379 --name redis -v redis-data:/data redis:latest
```

### Step 3: Verify
```bash
# Check if container is running
docker ps

# Test Redis
docker exec -it redis redis-cli ping
# Should return: PONG
```

**To stop Redis:**
```bash
docker stop redis
```

**To start Redis again:**
```bash
docker start redis
```

**To remove Redis container:**
```bash
docker rm -f redis
```

---

## Method 3: Using Memurai - 🪟 Windows Native

Memurai is a Redis-compatible server for Windows.

### Step 1: Download
- Download from: https://www.memurai.com/get-memurai
- Choose the free Developer Edition

### Step 2: Install
1. Run the installer
2. Follow the installation wizard
3. Memurai will install as a Windows service

### Step 3: Verify
```bash
# Test connection (Memurai uses same commands as Redis)
redis-cli ping
# Should return: PONG
```

**Note:** Memurai runs automatically as a Windows service, so you don't need to start it manually.

---

## Method 4: Using Chocolatey Package Manager

### Step 1: Install Chocolatey (if not installed)
```powershell
# Open PowerShell as Administrator
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### Step 2: Install Redis
```bash
choco install redis-64 -y
```

### Step 3: Start Redis
```bash
redis-server
```

---

## Verify Redis is Working

After installation, test the connection:

```bash
# Method 1: Using redis-cli
redis-cli ping
# Should return: PONG

# Method 2: Using Node.js
node -e "const Redis = require('ioredis'); const r = new Redis(); r.ping().then(console.log).then(() => r.quit());"
# Should return: PONG
```

## Configure Backend to Use Redis

Once Redis is running, your `.env` file should have:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

If Redis requires a password:
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

### Connection Refused
- Make sure Redis server is running
- Check REDIS_HOST and REDIS_PORT in `.env`
- Verify firewall isn't blocking the connection

## Recommended Setup

For **development**, I recommend:
1. **WSL + Redis** - Best compatibility, works like Linux
2. **Docker** - Easy to manage, isolated environment
3. **Memurai** - Windows native, runs as service

For **production**, use:
- Redis on Linux server
- Or managed Redis service (AWS ElastiCache, Redis Cloud, etc.)

## Next Steps

After Redis is installed and running:

1. ✅ Verify Redis: `redis-cli ping`
2. ✅ Update `.env` file with Redis configuration
3. ✅ Start backend: `npm run dev`
4. ✅ Check health endpoint: `http://localhost:5000/health`

Your backend should now connect to Redis successfully! 🎉

