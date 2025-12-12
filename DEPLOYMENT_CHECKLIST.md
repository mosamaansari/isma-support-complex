# 🚀 Vercel Deployment Checklist

## Pre-Deployment

### 1. GitHub Repository Setup
- [ ] Code GitHub par push karo
- [ ] Repository public ya private (your choice)
- [ ] README.md update karo (optional)

### 2. Database Setup
- [ ] PostgreSQL database create karo (Vercel Postgres ya external)
- [ ] Connection string ready hai
- [ ] Database accessible hai

### 3. Redis Setup
- [ ] Upstash Redis account banao
- [ ] Redis database create karo
- [ ] Connection details ready hain

## Frontend Deployment

### 4. Vercel Frontend Project
- [ ] Vercel account login karo
- [ ] "New Project" click karo
- [ ] GitHub repository select karo
- [ ] **Project Settings:**
  - [ ] Framework Preset: **Vite**
  - [ ] Root Directory: **/** (root)
  - [ ] Build Command: **npm run build**
  - [ ] Output Directory: **dist**
  - [ ] Install Command: **npm install**

### 5. Frontend Environment Variables
- [ ] `VITE_API_URL` add karo
- [ ] Value: `https://your-backend-url.vercel.app/api`
- [ ] Environment: Production, Preview, Development

### 6. Frontend Deploy
- [ ] "Deploy" click karo
- [ ] Build successful hai
- [ ] Frontend URL note karo

## Backend Deployment

### 7. Vercel Backend Project
- [ ] "New Project" click karo
- [ ] Same repository select karo
- [ ] **Project Settings:**
  - [ ] Framework Preset: **Other**
  - [ ] Root Directory: **backend**
  - [ ] Build Command: **npm run vercel-build**
  - [ ] Output Directory: **(leave empty)**
  - [ ] Install Command: **npm install**

### 8. Backend Environment Variables
- [ ] `DATABASE_URL` add karo
- [ ] `REDIS_HOST` add karo
- [ ] `REDIS_PORT` add karo
- [ ] `REDIS_PASSWORD` add karo
- [ ] `JWT_SECRET` add karo (min 32 chars)
- [ ] `JWT_EXPIRE` add karo (e.g., "7d")
- [ ] `CORS_ORIGIN` add karo (frontend URL)
- [ ] `NODE_ENV` = "production"
- [ ] `PORT` = "3000" (optional)
- [ ] `LOG_LEVEL` = "info"

### 9. Backend Deploy
- [ ] "Deploy" click karo
- [ ] Build successful hai
- [ ] Backend URL note karo

## Post-Deployment

### 10. Database Migration
- [ ] Prisma migrations run ho gayi hain
- [ ] Database tables create ho gayi hain
- [ ] Seed data run karo (optional)

### 11. Connection Testing
- [ ] Frontend backend se connect ho raha hai
- [ ] Health check: `https://backend-url.vercel.app/health`
- [ ] Login test karo
- [ ] API calls working hain

### 12. Final Verification
- [ ] Frontend load ho raha hai
- [ ] Login page accessible hai
- [ ] Default credentials se login ho raha hai
- [ ] Dashboard load ho raha hai
- [ ] No console errors
- [ ] No CORS errors

## URLs to Note

- Frontend URL: `https://________________.vercel.app`
- Backend URL: `https://________________.vercel.app`
- Health Check: `https://________________.vercel.app/health`
- API Base: `https://________________.vercel.app/api`

## Default Credentials

- **Admin:** `admin` / `admin123`
- **SuperAdmin:** `superadmin` / `superadmin123`

## Troubleshooting

Agar koi issue aaye:
1. Vercel logs check karo
2. Environment variables verify karo
3. Database connection test karo
4. CORS settings check karo
5. Build logs review karo

## Support

- Vercel Docs: https://vercel.com/docs
- Check `VERCEL_DEPLOYMENT.md` for detailed guide
- Check `VERCEL_ENV_SETUP.md` for environment variables

