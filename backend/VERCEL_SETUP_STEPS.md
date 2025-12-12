# Vercel Backend Setup - Step by Step

## ⚠️ Important: Vercel Dashboard Settings

Jab aap Vercel mein backend folder select karte ho, to ye settings configure karni hain:

### 1. Root Directory Setting (Most Important!)

**Vercel Dashboard → Project Settings → General → Root Directory**

- **Root Directory**: `backend` 
- Ye setting Vercel ko batati hai ki project ka root folder `backend` hai

### 2. Build Settings

**Vercel Dashboard → Settings → Build & Development Settings**

- **Framework Preset**: `Other`
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `.` (single dot)
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

### 3. Environment Variables

**Vercel Dashboard → Settings → Environment Variables**

Ye variables add karo:

```
DATABASE_URL=postgresql://user:password@host:5432/database
REDIS_HOST=your-redis-host
REDIS_PORT=6379
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
LOG_LEVEL=info
```

### 4. Deployment Steps

1. **GitHub Repository Setup**:
   - Code ko GitHub par push karo
   - Repository public ya private ho sakta hai

2. **Vercel Project Create**:
   - Vercel dashboard → "Add New Project"
   - GitHub repository select karo
   - **Root Directory**: `backend` select karo (dropdown se)
   - Build settings automatically detect ho jayengi `vercel.json` se

3. **Environment Variables Add**:
   - Settings → Environment Variables
   - Sabhi variables add karo

4. **Deploy**:
   - "Deploy" button click karo
   - Build logs check karo

### 5. After Deployment

Test karo:
- `https://your-project.vercel.app/` - API info
- `https://your-project.vercel.app/health` - Health check
- `https://your-project.vercel.app/api/auth/login` - Login

## Common Issues & Solutions

### Issue 1: "404: NOT FOUND"
**Solution**: Root Directory `backend` set karo Vercel dashboard mein

### Issue 2: Build Fails
**Solution**: 
- Check build logs
- Verify `DATABASE_URL` environment variable
- Check Prisma client generation

### Issue 3: Function Not Found
**Solution**: 
- Verify `api/index.ts` file exists
- Check `vercel.json` configuration
- Ensure handler export is correct

## Current Files Status

✅ `backend/vercel.json` - Configured
✅ `backend/api/index.ts` - Handler function ready
✅ `backend/package.json` - Build scripts ready

## Next Steps

1. Code ko GitHub par push karo
2. Vercel dashboard mein Root Directory `backend` set karo
3. Environment variables add karo
4. Deploy karo

