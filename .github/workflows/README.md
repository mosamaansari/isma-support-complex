# GitHub Actions - Cron Job Setup

## 📋 Overview

This folder contains GitHub Actions workflows for automated tasks.

## 🕐 Daily Cron Job (`daily-cron.yml`)

Automatically triggers the opening balance creation every day at **12:00 AM Pakistan Time (Midnight)**.

### Schedule
- **Cron Pattern:** `0 19 * * *`
- **UTC Time:** 7:00 PM
- **Pakistan Time:** 12:00 AM (Midnight) 🌙

### What It Does
1. Calculates previous day's closing balance
2. Creates today's opening balance
3. Sends notifications if it fails

## 🔧 Setup Instructions

### Step 1: Add GitHub Secret

1. Go to your GitHub repository
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secret:

   **Name:** `API_URL`  
   **Value:** `https://isma-support-complex-sigma.vercel.app`

### Step 2: Optional - Add Cron Secret (for authentication)

If you want to secure the cron endpoint:

1. Add another secret:
   
   **Name:** `CRON_SECRET_TOKEN`  
   **Value:** `your-secret-token-here` (generate a random string)

2. Update the workflow file to use it:
   ```yaml
   curl -X GET \
     "${{ secrets.API_URL }}/api/cron/trigger?token=${{ secrets.CRON_SECRET_TOKEN }}"
   ```

3. Set the same token in Vercel environment variables:
   - Go to Vercel Dashboard
   - Settings → Environment Variables
   - Add: `CRON_SECRET_TOKEN` = `your-secret-token-here`

### Step 3: Enable GitHub Actions

1. Go to your repository
2. Click on **Actions** tab
3. If prompted, enable GitHub Actions for this repository

### Step 4: Push to GitHub

```bash
git add .github/workflows/
git commit -m "Add GitHub Actions cron job for daily opening balance"
git push
```

## ✅ Verification

### Check if workflow is active:
1. Go to **Actions** tab in your GitHub repo
2. You should see "Daily Cron Job - Opening Balance" workflow
3. It will show the schedule and last run time

### Manual Test:
1. Go to **Actions** tab
2. Click on "Daily Cron Job - Opening Balance"
3. Click **Run workflow** button
4. Select branch (usually `main` or `master`)
5. Click **Run workflow**
6. Wait for it to complete and check the logs

## 📊 Monitoring

### View Logs:
1. Go to **Actions** tab
2. Click on a workflow run
3. Click on "trigger-cron" job
4. Expand steps to see detailed logs

### Success Indicators:
- ✅ Green checkmark on workflow run
- Response code: 200
- "Cron job executed successfully" message

### Failure Indicators:
- ❌ Red X on workflow run
- Non-200 response code
- Error message in logs

## 🔄 Changing Schedule

To change when the cron runs, edit `daily-cron.yml`:

```yaml
schedule:
  - cron: '0 19 * * *'  # Current: 12:00 AM PKT (Midnight)
```

### Common Schedules:

| Pakistan Time | UTC Time | Cron Pattern |
|--------------|----------|--------------|
| 12:00 AM (Midnight) | 7:00 PM | `0 19 * * *` |
| 1:00 AM | 8:00 PM | `0 20 * * *` |
| 6:00 AM | 1:00 AM | `0 1 * * *` |
| 9:00 AM | 4:00 AM | `0 4 * * *` |
| 12:00 PM (Noon) | 7:00 AM | `0 7 * * *` |

**Note:** Pakistan is UTC+5, so subtract 5 hours from Pakistan time to get UTC time.

## 🆘 Troubleshooting

### Workflow not running?
- Check if GitHub Actions is enabled for your repository
- Verify the workflow file is in `.github/workflows/` directory
- Check if there are any syntax errors in the YAML file

### Getting 404 errors?
- Verify `API_URL` secret is set correctly
- Make sure your API is deployed and accessible
- Test the endpoint manually: `curl https://your-api-url.vercel.app/api/cron/trigger`

### Getting 401 Unauthorized?
- If you set `CRON_SECRET_TOKEN`, make sure it matches in both:
  - GitHub Actions secret
  - Vercel environment variable
  - Workflow file (if using token in URL)

### Workflow times out?
- Default timeout is 6 hours
- If your cron job takes longer, increase timeout:
  ```yaml
  jobs:
    trigger-cron:
      runs-on: ubuntu-latest
      timeout-minutes: 10  # Adjust as needed
  ```

## 💡 Tips

1. **Test First:** Use "Manual workflow trigger" to test before relying on schedule
2. **Monitor Initially:** Check logs for first few days to ensure it's working
3. **Set Notifications:** Add Slack/Discord webhooks for failure alerts
4. **Backup Method:** Keep Vercel cron as backup (though you said it's not working)

## 📱 Adding Notifications

### Slack Notification Example:
Add this step to the workflow:

```yaml
- name: Send Slack notification on failure
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"text":"⚠️ Daily cron job failed!"}' \
      ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Discord Notification Example:
```yaml
- name: Send Discord notification on failure
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
      --data '{"content":"⚠️ Daily cron job failed!"}' \
      ${{ secrets.DISCORD_WEBHOOK_URL }}
```

## 🎯 Benefits of GitHub Actions

✅ **Free:** 2,000 minutes/month for free accounts  
✅ **Reliable:** More reliable than Vercel's serverless cron  
✅ **Flexible:** Easy to change schedule or add custom logic  
✅ **Visible:** Clear logs and monitoring in Actions tab  
✅ **No Cold Starts:** Unlike serverless functions  

---

**Need Help?** Check the workflow logs in the Actions tab for detailed error messages.

