# 🚀 Isma Sports Complex - Vercel Deployment

Complete sales & inventory management system deployed on Vercel.

## 📦 Quick Start

### 1. GitHub Upload
```bash
git init
git add .
git commit -m "Ready for Vercel"
git remote add origin https://github.com/yourusername/isma-sports-complex.git
git push -u origin main
```

### 2. Deploy Frontend

1. **Vercel.com** → New Project
2. GitHub repo import karo
3. **Settings:**
   - Framework: **Vite**
   - Build: `npm run build`
   - Output: `dist`
4. **Environment Variable:**
   ```
   VITE_API_URL=https://your-backend.vercel.app/api
   ```
5. Deploy!

### 3. Deploy Backend

1. **Vercel.com** → New Project
2. Same repo, **Root Directory:** `backend`
3. **Settings:**
   - Framework: **Other**
   - Build: `npm run vercel-build`
4. **Environment Variables** (see below)
5. Deploy!

## 🔐 Environment Variables

### Frontend
```
VITE_API_URL=https://backend-url.vercel.app/api
```

### Backend
```
DATABASE_URL=postgresql://...
REDIS_HOST=xxxx.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=...
JWT_SECRET=32-char-random-string
JWT_EXPIRE=7d
CORS_ORIGIN=https://frontend-url.vercel.app
NODE_ENV=production
```

## 📚 Detailed Guides

- **Quick Deploy:** `QUICK_DEPLOY.md`
- **Full Guide:** `VERCEL_DEPLOYMENT.md`
- **Environment Setup:** `VERCEL_ENV_SETUP.md`
- **Checklist:** `DEPLOYMENT_CHECKLIST.md`

## 🎯 Default Login

- **Admin:** `admin` / `admin123`
- **SuperAdmin:** `superadmin` / `superadmin123`

## ✅ After Deployment

1. Frontend: `https://your-frontend.vercel.app`
2. Backend: `https://your-backend.vercel.app`
3. Health: `https://your-backend.vercel.app/health`

---

**Note:** Database migration automatically run hogi first deploy par.

