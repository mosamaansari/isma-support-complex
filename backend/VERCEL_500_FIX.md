# Vercel 500 Error Fix

## Problem
Vercel is showing `500: INTERNAL_SERVER_ERROR` with `FUNCTION_INVOCATION_FAILED`.

## Root Cause
1. `vercel.json` was pointing to `dist/index.js` but `index.js` is in root directory
2. TypeScript compiles `src/` to `dist/src/`, not `dist/index.js`
3. The `index.js` file in root is CommonJS and imports from `./dist/src/routes/...`

## Solution
Updated `vercel.json` to point to root `index.js`:

```json
{
    "version": 2,
    "buildCommand": "npm install --include=dev && npm run vercel-build",
    "installCommand": "npm install --include=dev",
    "builds": [
        {
            "src": "index.js",
            "use": "@vercel/node",
            "config": { 
                "includeFiles": [
                    "dist/**", 
                    "node_modules/.prisma/**", 
                    "node_modules/@prisma/**"
                ] 
            }
        }
    ],
    "routes": [
        {
            "src": "/(.*)",
            "dest": "/index.js"
        }
    ]
}
```

## How It Works
1. **Build**: `npm run vercel-build` compiles TypeScript from `src/` to `dist/src/`
2. **Runtime**: Vercel loads root `index.js` (CommonJS)
3. **Imports**: `index.js` imports compiled routes from `dist/src/routes/...`
4. **Prisma**: Prisma client is generated and included in `includeFiles`

## Important Notes
- `index.js` must stay in root (not in `dist/`)
- TypeScript files compile to `dist/src/`
- Prisma client must be generated during build
- All environment variables must be set in Vercel dashboard

