# Quick Fix for Blank Screen

## The Most Likely Issue

The blank screen is usually caused by a JavaScript error. Here's how to see what's wrong:

### Step 1: Open Browser Console
1. Open http://localhost:5173 in your browser
2. Press **F12** to open Developer Tools
3. Click the **Console** tab
4. Look for **red error messages**

### Step 2: Common Fixes

**If you see WebSocket errors:**
- This is normal and won't cause a blank screen
- The app will use mock data instead

**If you see import/module errors:**
```bash
cd /home/sparky/Documents/zero-stress-sales-main
rm -rf node_modules/.vite
npm run dev
```

**If you see "Cannot read property" or similar:**
- Take a screenshot of the error
- Check if the error mentions a specific file

### Step 3: Hard Refresh
Press **Ctrl+Shift+R** (or **Cmd+Shift+R** on Mac) to clear cache and reload

### Step 4: Verify Servers
```bash
# Backend should return: {"status":"ok",...}
curl http://localhost:3001/health

# Frontend should return HTML
curl http://localhost:5173
```

### Step 5: Restart Everything
```bash
./STOP_SERVERS.sh
sleep 2
./START_SERVERS.sh
```

## Still Blank?

Please share:
1. **Screenshot of the browser console** (F12 → Console tab)
2. Any error messages you see

This will help identify the exact issue!

