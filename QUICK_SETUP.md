# Quick Setup Guide - Vercel + Database

## 🚀 Quick Steps

### 1. Vercel में Environment Variables Add करें

**Vercel Dashboard में:**
- Project → Settings → Environment Variables
- निम्नलिखित 3 variables add करें:

```
DATABASE_URL
postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require
```

```
POSTGRES_URL
postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require
```

```
PRISMA_DATABASE_URL
prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza184U0ZDV3VkandvU3lTYjY3b291SksiLCJhcGlfa2V5IjoiMDFLQzlaM0U2TkRUNTNSMTEyVzdQWlZRQ00iLCJ0ZW5hbnRfaWQiOiJmYmRmMmFlOTM5MTdmNDk3YmViZjY1MGE4NTM2MzRkYjE2Y2RkODRhZjJhZjA4OTI0ZmVkODQwZTMwNDUwYzA4IiwiaW50ZXJuYWxfc2VjcmV0IjoiODJlNzM3YjMtMDU0Ni00NTU0LWE3ZWYtMjM5MzJlNmM1MzA0In0.PAznlpRgYaaFTun3xgZnleRLr-WVtbK0XjB0nkjRM-4
```

- सभी environments (Production, Preview, Development) select करें
- Save करें

### 2. Database Tables Create करें

**Option 1: Local से (Recommended)**

```bash
cd backend

# .env file बनाएं
echo DATABASE_URL="postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require" > .env

# Prisma Client generate करें
npx prisma generate

# Database migrations deploy करें
npx prisma migrate deploy
```

**Option 2: Windows में**

```bash
cd backend

# .env file manually बनाएं या:
set DATABASE_URL=postgres://fbdf2ae93917f497bebf650a853634db16cdd84af2af08924fed840e30450c08:sk_xSFCWudjwoSySb67oouJK@db.prisma.io:5432/postgres?sslmode=require

npx prisma generate
npx prisma migrate deploy
```

**Option 3: Script Use करें**

Windows:
```bash
cd backend
.\setup-db.bat
```

Linux/Mac:
```bash
cd backend
chmod +x setup-db.sh
./setup-db.sh
```

### 3. Verify करें

```bash
# Database देखने के लिए
npx prisma studio
```

यह browser में database tables दिखाएगा।

### 4. Vercel पर Deploy करें

Environment variables add करने के बाद:
- Git push करें (अगर Git integration है)
- या manually deploy: `vercel --prod`

## ⚠️ Important Notes

1. **`.env` file को Git में commit न करें**
2. Production में `prisma migrate deploy` use करें (not `migrate dev`)
3. Vercel में environment variables add करना जरूरी है
4. Database connection के लिए SSL mode `require` है

## 🔧 Troubleshooting

**Connection Error आए तो:**
- DATABASE_URL check करें
- Database accessible है या नहीं verify करें
- Prisma Client generated है: `npx prisma generate`

**Migration Error आए तो:**
- पहले `npx prisma migrate status` check करें
- फिर `npx prisma migrate deploy` run करें






