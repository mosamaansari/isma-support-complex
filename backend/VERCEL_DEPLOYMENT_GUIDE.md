# Vercel Backend Deployment Guide

## Problem
Vercel par "404: NOT FOUND" aur "DEPLOYMENT_NOT_FOUND" error aa raha hai.

## Solution Steps

### 1. Vercel Dashboard Configuration

Vercel dashboard mein jao aur ye settings configure karo:

#### Project Settings:
1. **Root Directory**: `backend` set karo
   - Project Settings → General → Root Directory → `backend`

2. **Build & Development Settings**:
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `.` (dot)
   - **Install Command**: `npm install`
   - **Development Command**: `npm run dev`

### 2. Environment Variables

Vercel dashboard mein ye environment variables add karo:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host (Upstash Redis URL agar use kar rahe ho)
- `REDIS_PORT` - Redis port (agar needed ho)
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRE` - JWT expiration (default: "7d")
- `CORS_ORIGIN` - Frontend URL (e.g., `https://your-frontend.vercel.app`)
- `NODE_ENV` - `production`
- `LOG_LEVEL` - `info` ya `error`

### 3. Important Notes

1. **Root Directory**: Vercel ko batana hoga ki backend folder hi root hai
2. **Build Command**: `vercel-build` script Prisma generate aur TypeScript compile karega
3. **API Routes**: `api/index.ts` file Vercel serverless function ke liye automatically detect hogi

### 4. Deployment Steps

1. GitHub repository mein code push karo
2. Vercel dashboard mein:
   - New Project → Import Git Repository
   - Root Directory: `backend` select karo
   - Build settings automatically detect ho jayengi `vercel.json` se
3. Environment variables add karo
4. Deploy karo

### 5. After Deployment

Test these URLs:
- `https://your-backend.vercel.app/` - Should show API info
- `https://your-backend.vercel.app/health` - Health check
- `https://your-backend.vercel.app/api/auth/login` - Login endpoint

## Troubleshooting

### If still getting 404:
1. Check Root Directory setting in Vercel dashboard
2. Verify `vercel.json` exists in backend folder
3. Check build logs in Vercel dashboard
4. Ensure `api/index.ts` file exists and exports handler correctly

### Build Errors:
1. Check Prisma client generation
2. Verify database connection string
3. Check TypeScript compilation errors

## Current Configuration Files

- `backend/vercel.json` - Vercel configuration
- `backend/api/index.ts` - Serverless function handler
- `backend/package.json` - Build scripts

