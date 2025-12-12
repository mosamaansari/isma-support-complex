# ✅ Deployment Checklist - Frontend & Backend

## 📋 Pre-Deployment Checks

### ✅ Backend Configuration (`backend/vercel.json`)
- [x] Root Directory: `backend` (set in Vercel dashboard)
- [x] Build Command: `npm run vercel-build`
- [x] Install Command: `npm install --include=dev`
- [x] Output Directory: `.`
- [x] Framework: `Other` or `null`
- [x] Serverless function: `backend/api/index.ts` exists
- [x] Handler exports Express app correctly

### ✅ Frontend Configuration (`vercel.json`)
- [x] Root Directory: `/` (root)
- [x] Build Command: `npm run build`
- [x] Output Directory: `dist`
- [x] Framework: `Vite`
- [x] No backend API functions (removed)
- [x] Only frontend routing

### ✅ Backend Files
- [x] `backend/api/index.ts` - Serverless function handler
- [x] `backend/package.json` - Build scripts correct
- [x] `backend/vercel.json` - Configuration correct
- [x] `backend/tsconfig.json` - Includes api folder

### ✅ Frontend Files
- [x] `vercel.json` - Frontend only configuration
- [x] `package.json` - Build scripts correct
- [x] No `api/` folder in root (backend only)

## 🚀 Deployment Steps

### Backend Deployment

1. **Vercel Dashboard Settings:**
   - Root Directory: `backend`
   - Framework: `Other`
   - Build Command: `npm run vercel-build`
   - Output Directory: `.`
   - Install Command: `npm install --include=dev`

2. **Environment Variables:**
   ```
   DATABASE_URL=your_postgresql_connection_string
   REDIS_HOST=your_redis_host
   REDIS_PORT=6379
   JWT_SECRET=your_jwt_secret
   JWT_EXPIRE=7d
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   NODE_ENV=production
   LOG_LEVEL=info
   ```

3. **Deploy:**
   - Push to GitHub
   - Vercel will auto-deploy
   - Check build logs

### Frontend Deployment

1. **Vercel Dashboard Settings:**
   - Root Directory: `/` (root)
   - Framework: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

2. **Environment Variables:**
   ```
   VITE_API_URL=https://your-backend-url.vercel.app/api
   ```

3. **Deploy:**
   - Push to GitHub
   - Vercel will auto-deploy
   - Check build logs

## ✅ Post-Deployment Tests

### Backend Tests
- [ ] `https://your-backend.vercel.app/` - API info
- [ ] `https://your-backend.vercel.app/health` - Health check
- [ ] `https://your-backend.vercel.app/api/auth/login` - Login endpoint

### Frontend Tests
- [ ] `https://your-frontend.vercel.app/` - Homepage loads
- [ ] Login page works
- [ ] API calls to backend work

## 🔧 Common Issues Fixed

1. ✅ Removed backend API functions from frontend `vercel.json`
2. ✅ Fixed build commands to use `npx tsc`
3. ✅ Added `--include=dev` to install commands
4. ✅ Separated frontend and backend configurations
5. ✅ Verified serverless function handler format

## 📝 Notes

- **Separate Projects**: Frontend and backend should be separate Vercel projects
- **Root Directory**: Critical setting - must match folder structure
- **Build Commands**: Use `npx` for commands in devDependencies
- **Environment Variables**: Set in Vercel dashboard, not in code

