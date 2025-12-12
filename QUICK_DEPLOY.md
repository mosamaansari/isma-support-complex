# ⚡ Quick Vercel Deployment Guide

## 🎯 Fastest Way to Deploy

### Step 1: GitHub Upload
```bash
git init
git add .
git commit -m "Ready for Vercel deployment"
git remote add origin https://github.com/yourusername/isma-sports-complex.git
git push -u origin main
```

### Step 2: Frontend Deploy (5 minutes)

1. **Vercel.com** par jao → Login
2. **"Add New..."** → **"Project"**
3. GitHub repository import karo
4. **Project Settings:**
   ```
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build
   Output Directory: dist
   ```
5. **Environment Variables:**
   ```
   VITE_API_URL = https://your-backend-url.vercel.app/api
   ```
   (Pehle backend deploy karo, phir ye URL update karo)
6. **Deploy** click karo

### Step 3: Backend Deploy (10 minutes)

1. **Vercel.com** → **"Add New..."** → **"Project"**
2. Same repository select karo
3. **Project Settings:**
   ```
   Framework Preset: Other
   Root Directory: backend
   Build Command: npm run vercel-build
   Output Directory: (leave empty)
   ```
4. **Environment Variables** add karo (see below)
5. **Deploy** click karo

### Step 4: Database & Redis Setup

#### Database (PostgreSQL)
- **Option 1:** Vercel Postgres (Easiest)
  - Vercel Dashboard → Storage → Create Database → Postgres
  - Connection string copy karo
  
- **Option 2:** Supabase (Free)
  - https://supabase.com → Create Project
  - Settings → Database → Connection String

#### Redis (Upstash - Free)
- https://upstash.com → Sign Up
- Create Database → Redis
- Connection details copy karo

### Step 5: Environment Variables (Backend)

Vercel Backend Project → Settings → Environment Variables:

```env
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require
REDIS_HOST=xxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-password
JWT_SECRET=generate-32-char-random-string
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
LOG_LEVEL=info
```

### Step 6: Update Frontend URL

Backend deploy hone ke baad:
1. Backend URL copy karo
2. Frontend project → Settings → Environment Variables
3. `VITE_API_URL` update karo: `https://backend-url.vercel.app/api`
4. Redeploy frontend

### Step 7: Database Migration

Backend deploy ke baad automatically run hogi, ya manually:

```bash
cd backend
npx prisma migrate deploy
```

## ✅ Test Deployment

1. Frontend: `https://your-frontend.vercel.app`
2. Backend Health: `https://your-backend.vercel.app/health`
3. Login: `admin` / `admin123`

## 🔗 Important URLs

After deployment, note these:
- Frontend: `________________________`
- Backend: `________________________`
- API: `________________________/api`

## 📝 Notes

- First deployment 5-10 minutes lega
- Environment variables add karne ke baad redeploy zaroori hai
- Database migration automatically run hogi
- Redis optional hai (app bina Redis bhi chalega)

## 🆘 Quick Fixes

**Build Fails?**
- Check Vercel build logs
- Verify all dependencies in package.json

**API Not Working?**
- Check CORS_ORIGIN matches frontend URL exactly
- Verify VITE_API_URL in frontend

**Database Error?**
- Check DATABASE_URL format
- Verify SSL mode (require)

**Need Help?**
- Check `VERCEL_DEPLOYMENT.md` for detailed guide
- Check `VERCEL_ENV_SETUP.md` for env variables

