# 🚀 GitHub Actions Cron Job - Quick Setup Guide

## ✅ Kya Bana Hai

GitHub Actions se automatic cron job jo **har raat 12 baje (midnight)** chalega.

## 📝 Setup Steps (5 Minutes)

### Step 1: GitHub Secret Add Karo

1. Apne GitHub repository pe jao
2. **Settings** → **Secrets and variables** → **Actions** pe click karo
3. **New repository secret** button pe click karo
4. Ye add karo:

   ```
   Name: API_URL
   Value: https://isma-support-complex-sigma.vercel.app
   ```

5. **Add secret** button pe click karo

### Step 2: Code Push Karo

```bash
# 1. Files add karo
git add .github/

# 2. Commit karo
git commit -m "Add GitHub Actions cron job for daily tasks"

# 3. Push karo
git push origin main
```

> **Note:** Agar aapki default branch `master` hai to `main` ki jagah `master` use karo

### Step 3: Verify Karo

1. GitHub pe apne repo me jao
2. **Actions** tab pe click karo
3. "Daily Cron Job - Opening Balance" workflow dikhayi degi
4. Schedule dikhega: "Every day at 7:00 PM UTC" (= 12:00 AM Pakistan Time)

### Step 4: Manual Test Karo (Optional but Recommended)

1. **Actions** tab me jao
2. "Daily Cron Job - Opening Balance" pe click karo
3. **Run workflow** button pe click karo
4. Branch select karo (main/master)
5. **Run workflow** pe click karo
6. Wait karo aur logs dekho

✅ Agar green checkmark aaye to sab kuch perfect hai!

## 🕐 Schedule

- **Pakistan Time:** 12:00 AM (Midnight) 🌙
- **UTC Time:** 7:00 PM
- **Cron Pattern:** `0 19 * * *`

## 🔐 Optional: Secure Karo

Agar chahte ho ke sirf authorized requests hi accept ho:

### 1. Random Token Generate Karo

```bash
# Terminal me run karo
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ya manually koi strong password banao.

### 2. GitHub Secret Add Karo

```
Name: CRON_SECRET_TOKEN
Value: your-generated-token-here
```

### 3. Vercel Environment Variable Add Karo

Vercel Dashboard me:
```
Key: CRON_SECRET_TOKEN
Value: your-generated-token-here (same as GitHub secret)
```

### 4. Workflow Update Karo

`.github/workflows/daily-cron.yml` me:

```yaml
# Line 18-19 ko replace karo:
curl -s -w "\n%{http_code}" -X GET \
  "${{ secrets.API_URL }}/api/cron/trigger?token=${{ secrets.CRON_SECRET_TOKEN }}"
```

## 📊 Monitoring

### Logs Kahan Dekhe?

1. GitHub repo → **Actions** tab
2. Latest workflow run pe click karo
3. "trigger-cron" job pe click karo
4. Har step expand karke dekh sakte ho

### Success Ka Pata Kaise Chalega?

- ✅ Green checkmark workflow pe
- Response: 200 OK
- Message: "Cron job executed successfully"

### Failure Ka Pata?

- ❌ Red X workflow pe
- Email notification GitHub se aayega
- Logs me error message dikhega

## 🔄 Time Change Karna Ho To?

`.github/workflows/daily-cron.yml` file me ye line edit karo:

```yaml
schedule:
  - cron: '0 19 * * *'  # Change this
```

### Common Timings:

| Pakistan Time | Change To |
|--------------|-----------|
| 12:00 AM (Current) | `0 19 * * *` ✅ |
| 1:00 AM | `0 20 * * *` |
| 2:00 AM | `0 21 * * *` |
| 6:00 AM | `0 1 * * *` |
| 12:00 PM (Noon) | `0 7 * * *` |

## 🆘 Problems?

### Workflow dikhayi nahi de raha?
- Check karo `.github/workflows/` folder me file hai
- GitHub Actions enabled hai repository me?
- File name `.yml` extension ke saath hai?

### "API_URL not found" error?
- GitHub Settings → Secrets → Actions me `API_URL` add kiya hai?
- Spelling correct hai?

### 404 Error?
- Vercel pe API deploy hai?
- URL correct hai?
- Browser me test karo: `https://isma-support-complex-sigma.vercel.app/api/cron/status`

### 401 Unauthorized?
- Agar token use kar rahe ho, to same token GitHub aur Vercel dono me hai?
- Token sahi secret name se add kiya?

## 💡 Pro Tips

1. **Pehle Test Karo:** Manual trigger karke dekho sab kuch kaam kar raha hai
2. **Logs Monitor Karo:** Pehle 2-3 din logs check karte raho
3. **Backup:** Vercel cron bhi chalu rakho (agar kaam kare to)
4. **Notifications:** Slack/Discord webhook add kar sakte ho failure pe alert ke liye

## 🎯 Benefits

✅ **Free:** 2,000 minutes/month free  
✅ **Reliable:** Serverless se zyada reliable  
✅ **Easy:** Manage karna bahut easy hai  
✅ **Visible:** Clear logs aur history  
✅ **Control:** Kisi bhi time manual trigger kar sakte ho  

## 📱 Next Steps

1. ✅ Setup complete karo (Steps 1-3)
2. ✅ Manual test karo (Step 4)
3. ✅ Kal morning check karo logs me
4. ✅ Database me verify karo opening balance create hui

---

## 🎉 Done!

Bas itna hi! Ab har raat 12 baje automatic cron job chalega aur:
- Previous day ka closing balance calculate karega
- Agle din ka opening balance create karega

Koi problem ho to `.github/workflows/README.md` me detailed troubleshooting guide hai.

**Questions?** GitHub Actions tab me logs dekho ya mujhe batao! 🚀

