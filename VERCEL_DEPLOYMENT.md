# Vercel Deployment Guide

Isma Sports Complex ko Vercel par deploy karne ka complete guide.

## 📋 Prerequisites

1. GitHub account
2. Vercel account (free tier available)
3. PostgreSQL database (Vercel Postgres ya external service)
4. Redis (Upstash Redis recommended for Vercel)

## 🚀 Deployment Steps

### Option 1: Separate Projects (Recommended)

#### Frontend Deployment

1. **GitHub Repository Setup:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/isma-sports-complex.git
   git push -u origin main
   ```

2. **Vercel Frontend Project:**
   - Vercel dashboard par jao: https://vercel.com
   - "New Project" click karo
   - GitHub repository select karo
   - **Root Directory:** Root folder (frontend)
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

3. **Environment Variables (Frontend):**
   ```
   VITE_API_URL=https://your-backend-url.vercel.app/api
   ```

#### Backend Deployment

1. **Vercel Backend Project:**
   - Vercel dashboard par "New Project" click karo
   - Same repository select karo
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - **Build Command:** `npm run build && npm run prisma:generate`
   - **Output Directory:** (leave empty)
   - **Install Command:** `npm install`

2. **Environment Variables (Backend):**
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=your_postgresql_connection_string
   REDIS_HOST=your_redis_host
   REDIS_PORT=6379
   REDIS_PASSWORD=your_redis_password
   JWT_SECRET=your_very_secure_jwt_secret_key
   JWT_EXPIRE=7d
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   LOG_LEVEL=info
   ```

### Option 2: Monorepo (Single Project)

Agar aap ek hi project mein dono deploy karna chahte ho:

1. **Vercel Project Setup:**
   - Root directory: Root folder
   - Build settings:
     - Frontend: `npm run build` (root)
     - Backend: `cd backend && npm run build && npm run prisma:generate`

2. **vercel.json** already configured hai root mein

## 🔧 Environment Variables Setup

### Frontend (.env.production)

```env
VITE_API_URL=https://your-backend-url.vercel.app/api
```

### Backend Environment Variables (Vercel Dashboard)

1. Vercel project settings mein jao
2. "Environment Variables" section mein jao
3. Ye variables add karo:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Redis (Upstash recommended)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-very-secure-secret-key-min-32-characters
JWT_EXPIRE=7d

# CORS
CORS_ORIGIN=https://your-frontend-url.vercel.app

# Other
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## 📦 Database Setup

### Option 1: Vercel Postgres (Recommended)

1. Vercel dashboard mein "Storage" section
2. "Create Database" → "Postgres"
3. Database create karo
4. Connection string copy karo
5. `DATABASE_URL` environment variable mein add karo

### Option 2: External PostgreSQL

- Supabase (Free tier available)
- Railway
- Render
- Neon

Connection string format:
```
postgresql://user:password@host:port/database?sslmode=require
```

## 🔴 Redis Setup (Upstash - Recommended for Vercel)

1. https://upstash.com par account banao
2. "Create Database" → "Redis"
3. Region select karo (Vercel ke closest)
4. Database create karo
5. Connection details copy karo:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`

## 🗄️ Database Migration

Vercel par deploy hone ke baad:

1. **Prisma Migration:**
   ```bash
   # Local se run karo (Vercel automatically runs migrations)
   cd backend
   npx prisma migrate deploy
   ```

   Ya Vercel Build Command mein add karo:
   ```json
   "build": "npm run prisma:generate && npm run build && npx prisma migrate deploy"
   ```

2. **Seed Data (Optional):**
   ```bash
   cd backend
   npm run prisma:seed
   ```

## 🔗 Connecting Frontend to Backend

1. Frontend Vercel project mein:
   - Environment variable: `VITE_API_URL`
   - Value: `https://your-backend-url.vercel.app/api`

2. Backend Vercel project mein:
   - Environment variable: `CORS_ORIGIN`
   - Value: `https://your-frontend-url.vercel.app`

## 📝 Vercel Configuration Files

### Root vercel.json (Monorepo)
- Already created
- Frontend build aur routing handle karta hai

### backend/vercel.json
- Backend serverless function configuration
- API routes handle karta hai

## 🚨 Important Notes

1. **Redis in Serverless:**
   - Upstash Redis use karo (serverless-friendly)
   - Traditional Redis serverless mein kaam nahi karega

2. **Database Connections:**
   - Connection pooling important hai
   - Prisma automatically handles this

3. **Environment Variables:**
   - Production, Preview, Development ke liye alag values set kar sakte ho
   - Sensitive data ke liye Vercel Secrets use karo

4. **Build Time:**
   - First build thoda time lega
   - Prisma generate aur migrations run hongi

5. **Logs:**
   - Vercel dashboard mein "Logs" section check karo
   - Real-time logs available hain

## 🔍 Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json
- Check Node.js version (Vercel auto-detects)

### Database Connection Issues
- Verify DATABASE_URL format
- Check SSL mode (require for most cloud databases)
- Ensure database allows connections from Vercel IPs

### CORS Errors
- Verify CORS_ORIGIN matches frontend URL exactly
- Check backend CORS configuration

### API Not Working
- Verify API routes are correct
- Check Vercel function logs
- Ensure backend is deployed successfully

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Upstash Redis](https://upstash.com/docs)
- [Prisma Deployment](https://www.prisma.io/docs/guides/deployment)

## ✅ Deployment Checklist

- [ ] GitHub repository created
- [ ] Frontend Vercel project created
- [ ] Backend Vercel project created
- [ ] Database setup (PostgreSQL)
- [ ] Redis setup (Upstash)
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Frontend connected to backend
- [ ] CORS configured
- [ ] Test deployment

## 🎉 After Deployment

1. Frontend URL: `https://your-frontend.vercel.app`
2. Backend URL: `https://your-backend.vercel.app`
3. Health Check: `https://your-backend.vercel.app/health`
4. API Base: `https://your-backend.vercel.app/api`

Default Login:
- Username: `admin`
- Password: `admin123`

SuperAdmin Login:
- Username: `superadmin`
- Password: `superadmin123`

