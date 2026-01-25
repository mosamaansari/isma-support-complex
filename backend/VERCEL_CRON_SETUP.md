# Vercel Cron Setup for Automatic Daily Tasks

## Overview
This application uses cron jobs to automatically:
1. Calculate and store previous day's closing balance
2. Create today's opening balance from previous day's closing

## Two Ways to Trigger Cron:

### 1. Vercel Automatic Cron (Recommended for Production)
The `vercel.json` file is configured with:
```json
"crons": [
  {
    "path": "/api/cron/trigger",
    "schedule": "0 0 * * *"
  }
]
```

This will automatically call the cron endpoint **daily at 12:00 AM UTC**.

**Note:** Vercel Cron uses UTC timezone by default. If you need it to run at 12:00 AM Pakistan time (PKT = UTC+5), adjust the schedule to:
```json
"schedule": "0 19 * * *"  // 7:00 PM UTC = 12:00 AM PKT
```

### 2. Manual API Trigger (For Testing or External Services)

#### Endpoint:
```
POST https://your-domain.vercel.app/api/cron/trigger
```

#### Security (Optional):
Set `CRON_SECRET_TOKEN` in Vercel environment variables to protect the endpoint:

```bash
# In Vercel Dashboard: Settings > Environment Variables
CRON_SECRET_TOKEN=your-secret-token-here
```

Then call with header or query parameter:
```bash
# With header
curl -X POST https://your-domain.vercel.app/api/cron/trigger \
  -H "x-cron-secret: your-secret-token-here"

# Or with query parameter
curl -X POST "https://your-domain.vercel.app/api/cron/trigger?token=your-secret-token-here"
```

#### Without Authentication (if CRON_SECRET_TOKEN is not set):
```bash
curl -X POST https://your-domain.vercel.app/api/cron/trigger
```

### 3. Status Check Endpoint
Check if cron service is running:
```
GET https://your-domain.vercel.app/api/cron/status
```

## Vercel Dashboard Setup

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Cron Jobs**
3. You should see the cron job listed there (after deployment)
4. Vercel will automatically call your endpoint at the scheduled time

## External Cron Services (Alternative)

If Vercel Cron is not available or you want more control, use external services:

### Option 1: cron-job.org
1. Visit https://cron-job.org
2. Create free account
3. Add new cron job:
   - URL: `https://your-domain.vercel.app/api/cron/trigger`
   - Schedule: Daily at 12:00 AM
   - Timezone: Asia/Karachi

### Option 2: EasyCron
1. Visit https://www.easycron.com
2. Create cron job with same settings

### Option 3: GitHub Actions (Free)
Create `.github/workflows/cron.yml`:
```yaml
name: Daily Cron Job
on:
  schedule:
    - cron: '0 19 * * *'  # 12:00 AM PKT
  workflow_dispatch:  # Manual trigger

jobs:
  trigger-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cron API
        run: |
          curl -X POST https://your-domain.vercel.app/api/cron/trigger \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET_TOKEN }}"
```

## Testing

### Test Immediately:
```bash
# Local
curl -X POST http://localhost:5000/api/cron/trigger

# Production
curl -X POST https://your-domain.vercel.app/api/cron/trigger
```

### Check Logs:
- **Vercel**: Dashboard > Deployments > [Latest] > Functions > Logs
- **Local**: Check console output or logs folder

## Troubleshooting

### Cron not running on Vercel?
1. Check if `crons` is added to `vercel.json`
2. Verify the endpoint path is correct: `/api/cron/trigger`
3. Check Vercel dashboard > Settings > Cron Jobs
4. View function logs in Vercel dashboard

### Unauthorized errors?
- If `CRON_SECRET_TOKEN` is set in env, you must provide it
- Or remove `CRON_SECRET_TOKEN` from environment variables

### Manual trigger not working?
- Check endpoint URL is correct
- Verify API is deployed and accessible
- Check logs for error messages

## Important Notes

1. **Vercel Serverless Limitations**: 
   - Serverless functions have 10-second timeout on Hobby plan
   - If cron job takes longer, use external service instead

2. **Database Connection**:
   - Ensure `DATABASE_URL` is set in Vercel environment variables
   - Connection pooling is recommended for serverless

3. **Timezone**:
   - Vercel Cron uses UTC
   - Adjust schedule accordingly for Pakistan timezone
   - Or use external service with timezone support

