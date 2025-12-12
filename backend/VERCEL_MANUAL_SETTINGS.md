# Vercel Dashboard - Manual Settings Configuration

## Current Status
✅ Root Directory: `backend` (Already set correctly)
❌ Build Command: "None" (Needs to be set)
❌ Output Directory: "N/A" (Needs to be set)

## Required Settings in Vercel Dashboard

### Step 1: Go to Settings
Vercel Dashboard → Your Project → Settings → Build and Deployment

### Step 2: Configure Build Settings

**Build Command:**
1. "Override" toggle ko **ON** karein (Build Command ke right side mein)
2. Input field mein ye command enter karein:
   ```
   npm run vercel-build
   ```

**Output Directory:**
1. "Override" toggle ko **ON** karein (Output Directory ke right side mein)
2. Input field mein ye enter karein:
   ```
   .
   ```
   (Single dot - ye batata hai ki output same directory mein hai)

**Install Command:**
- Default (`npm install`) theek hai, override ki zaroorat nahi

**Development Command:**
- Optional hai, agar override karna ho to:
  ```
  npm run dev
  ```

### Step 3: Save Settings
- "Save" button click karein (bottom mein)

## After Saving

1. **Redeploy:**
   - Deployments page par jao
   - Latest deployment par "Redeploy" click karo
   - Ya naya commit push karo

2. **Verify Build:**
   - Build logs check karo
   - Ab build successfully complete hona chahiye

## Expected Build Output

Build logs mein ye dikhna chahiye:
```
> npx prisma generate
> npx tsc
```

Agar build successful ho, to deployment ab blank nahi rahega aur API responses properly kaam karengi.

## Important Notes

- `vercel.json` file mein bhi ye settings hain, lekin Vercel dashboard mein manually set karna better hai
- Build Command `npm run vercel-build` hai jo `npx prisma generate && npx tsc` run karega
- Output Directory `.` (dot) hai kyunki serverless functions ke liye output same directory mein hota hai

