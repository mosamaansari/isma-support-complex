# Vercel Environment Variables Setup

## Frontend Environment Variables

Vercel Frontend Project → Settings → Environment Variables:

```
VITE_API_URL = https://your-backend-project.vercel.app/api
```

**Important:** 
- Variable name `VITE_` se start hona chahiye
- Production, Preview, Development ke liye same value ya different values set kar sakte ho

## Backend Environment Variables

Vercel Backend Project → Settings → Environment Variables:

### Required Variables

```env
# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Redis (Upstash recommended)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Authentication
JWT_SECRET=your-very-secure-secret-key-minimum-32-characters-long
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=https://your-frontend-project.vercel.app

# Environment
NODE_ENV=production
PORT=3000

# Logging
LOG_LEVEL=info
```

### How to Get Values

#### 1. DATABASE_URL (PostgreSQL)

**Option A: Vercel Postgres**
1. Vercel Dashboard → Storage → Create Database → Postgres
2. Database create karo
3. Settings → Connection String copy karo
4. Format: `postgresql://user:password@host:port/database?sslmode=require`

**Option B: External PostgreSQL**
- Supabase: Project Settings → Database → Connection String
- Railway: Database → Connect → Connection URL
- Render: Database → Internal Database URL

#### 2. Redis (Upstash)

1. https://upstash.com par account banao
2. Create Database → Redis
3. Region select karo (Vercel ke closest)
4. Database create karo
5. Details copy karo:
   - **REDIS_HOST:** `xxxx.upstash.io`
   - **REDIS_PORT:** `6379` (usually)
   - **REDIS_PASSWORD:** Database password

#### 3. JWT_SECRET

Generate a secure random string:
```bash
# Linux/Mac
openssl rand -base64 32

# Or use online generator
# https://generate-secret.vercel.app/32
```

Minimum 32 characters recommended.

#### 4. CORS_ORIGIN

Frontend Vercel project ka URL:
```
https://your-frontend-project.vercel.app
```

## Setting Variables in Vercel

1. Vercel Dashboard → Your Project → Settings
2. "Environment Variables" section
3. "Add New" click karo
4. Key aur Value enter karo
5. Environment select karo (Production/Preview/Development)
6. "Save" click karo

## Environment-Specific Values

Agar different environments ke liye different values chahiye:

- **Production:** Live deployment ke liye
- **Preview:** Pull request previews ke liye
- **Development:** Local development ke liye (optional)

Example:
```
# Production
CORS_ORIGIN=https://isma-sports.vercel.app

# Preview
CORS_ORIGIN=https://isma-sports-git-branch.vercel.app

# Development
CORS_ORIGIN=http://localhost:5173
```

## Verification

Deploy ke baad verify karo:

1. **Backend Health Check:**
   ```
   https://your-backend.vercel.app/health
   ```
   Should return: `{"status":"ok","database":"connected"}`

2. **Frontend API Connection:**
   - Browser console check karo
   - Network tab mein API calls verify karo
   - CORS errors check karo

## Security Notes

1. **Never commit .env files** to GitHub
2. **Use Vercel Secrets** for sensitive data
3. **Rotate JWT_SECRET** regularly
4. **Use strong passwords** for database and Redis
5. **Enable SSL/TLS** for all connections

## Quick Setup Script

Vercel CLI se bhi set kar sakte ho:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add REDIS_HOST production
vercel env add REDIS_PASSWORD production
vercel env add JWT_SECRET production
vercel env add CORS_ORIGIN production
```

## Troubleshooting

### Variable Not Working
- Check variable name (case-sensitive)
- Verify environment (Production/Preview)
- Redeploy after adding variables
- Check build logs

### Database Connection Failed
- Verify DATABASE_URL format
- Check SSL mode
- Ensure database allows external connections
- Check firewall settings

### Redis Connection Failed
- Verify REDIS_HOST format
- Check REDIS_PORT (usually 6379)
- Verify REDIS_PASSWORD
- Check Upstash dashboard for connection status

