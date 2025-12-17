# Vercel Environment Variables Setup Guide

## Step 1: Add Environment Variables in Vercel Dashboard

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Select your project

2. **Navigate to Settings**
   - Click on your project
   - Go to **Settings** → **Environment Variables**

3. **Add the following Environment Variables:**

   ```
   DATABASE_URL=postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require
   ```

   ```
   POSTGRES_URL=postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require
   ```

   ```
   PRISMA_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza184U0ZDV3VkandvU3lTYjY3b291SksiLCJhcGlfa2V5IjoiMDFLQzlaM0U2TkRUNTNSMTEyVzdQWlZRQ00iLCJ0ZW5hbnRfaWQiOiJmYmRmMmFlOTM5MTdmNDk3YmViZjY1MGE4NTM2MzRkYjE2Y2RkODRhZjJhZjA4OTI0ZmVkODQwZTMwNDUwYzA4IiwiaW50ZXJuYWxfc2VjcmV0IjoiODJlNzM3YjMtMDU0Ni00NTU0LWE3ZWYtMjM5MzJlNmM1MzA0In0.PAznlpRgYaaFTun3xgZnleRLr-WVtbK0XjB0nkjRM-4
   ```

4. **Select Environments:**
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Click "Save"**

## Step 2: Create Database Schema

After adding environment variables, you need to run migrations to create the database tables.

### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run migrations
cd backend
npx prisma migrate deploy
```

### Option B: Using Prisma Studio (Local Development)

```bash
cd backend

# Set environment variable locally
export DATABASE_URL="postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require"

# Or create .env file
echo 'DATABASE_URL="postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require"' > .env

# Generate Prisma Client
npx prisma generate

# Deploy migrations (creates all tables)
npx prisma migrate deploy
```

### Option C: Using Prisma Migrate Dev (Development)

```bash
cd backend

# Create .env file with DATABASE_URL
echo 'DATABASE_URL="postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require"' > .env

# Create and apply migration
npx prisma migrate dev --name init
```

## Step 3: Verify Database Setup

```bash
# Open Prisma Studio to view database
npx prisma studio
```

This will open a browser window where you can see all your tables.

## Step 4: Deploy to Vercel

After setting up environment variables and database:

1. **Push to Git** (if using Git integration)
2. **Or deploy manually:**
   ```bash
   vercel --prod
   ```

## Important Notes:

- ⚠️ **Never commit `.env` files to Git**
- ✅ Always use Vercel Dashboard for production environment variables
- ✅ Use `prisma migrate deploy` for production (not `migrate dev`)
- ✅ The `PRISMA_DATABASE_URL` is for Prisma Accelerate (optional, for better performance)

## Troubleshooting:

If you get connection errors:
1. Check if DATABASE_URL is correct
2. Verify database is accessible from Vercel's IP ranges
3. Check SSL mode is set to `require`
4. Ensure Prisma Client is generated: `npx prisma generate`






