# Troubleshooting Guide - Sales Entry Page Blank

## Issue: Sales Entry Page Showing Blank

### Possible Causes:

1. **Backend Not Running**
   - Backend server must be running on port 5000
   - Check: `http://localhost:5000/health`

2. **User Not Logged In**
   - Page requires authentication
   - Login first at `/signin`

3. **API Connection Error**
   - Check browser console for errors
   - Verify `VITE_API_URL` in `.env` file

4. **Products Not Loading**
   - API call might be failing
   - Check Network tab in browser DevTools

## Quick Fixes:

### 1. Check Backend Status
```bash
cd backend
npm run dev
```

### 2. Check Frontend .env
Create `src/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Check Browser Console
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

### 4. Verify Login
- Make sure you're logged in
- Check `localStorage` for `authToken` and `currentUser`

## Debug Steps:

1. **Open Browser Console**
   - Press F12
   - Go to Console tab
   - Look for red errors

2. **Check Network Requests**
   - Go to Network tab
   - Refresh page
   - Look for failed API calls (red)

3. **Check Local Storage**
   - Go to Application tab
   - Check Local Storage
   - Should have `authToken` and `currentUser`

4. **Verify Backend**
   - Open `http://localhost:5000/health`
   - Should return JSON with status: "ok"

## Common Errors:

### Error: "Network Error"
- Backend not running
- Wrong API URL
- CORS issue

### Error: "401 Unauthorized"
- Token expired
- Not logged in
- Invalid credentials

### Error: "Failed to load products"
- Database not connected
- Products table empty
- API endpoint issue

## Solution:

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Login: Go to `/signin` and login
4. Try again: Go to `/sales/entry`

If still blank, check browser console for specific error message.

