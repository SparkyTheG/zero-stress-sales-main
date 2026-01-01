# Troubleshooting Blank Screen

If you see a blank/black screen, follow these steps:

## Step 1: Open Browser Developer Tools

1. Press **F12** or **Right-click → Inspect**
2. Go to the **Console** tab
3. Look for any red error messages
4. Take a screenshot or copy the errors

## Step 2: Check Network Tab

1. In Developer Tools, go to **Network** tab
2. Refresh the page (F5)
3. Check if files are loading:
   - `index.html` - should be 200
   - `main.tsx` - should be 200
   - `index.css` - should be 200
   - Any files showing 404 or errors?

## Step 3: Common Issues

### Issue: "Failed to fetch dynamically imported module"
**Solution:** Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)

### Issue: "Cannot find module" or import errors
**Solution:** 
```bash
cd /home/sparky/Documents/zero-stress-sales-main
rm -rf node_modules/.vite
npm run dev
```

### Issue: Tailwind CSS not working (page is completely black)
**Solution:**
```bash
# Check if Tailwind is installed
npm list tailwindcss

# If not, install it
npm install -D tailwindcss postcss autoprefixer
```

### Issue: WebSocket connection errors
**Note:** This is OK! The app will work with mock data. WebSocket errors won't cause a blank screen.

## Step 4: Verify Servers Are Running

```bash
# Check backend
curl http://localhost:3001/health

# Check frontend
curl http://localhost:5173
```

## Step 5: Try These Commands

```bash
# Stop everything
./STOP_SERVERS.sh

# Clear Vite cache
cd /home/sparky/Documents/zero-stress-sales-main
rm -rf node_modules/.vite

# Reinstall dependencies (if needed)
npm install

# Start fresh
./START_SERVERS.sh
```

## Step 6: Test in Different Browser

Try opening http://localhost:5173 in:
- Chrome/Chromium
- Firefox
- Edge

## Step 7: Check the Actual HTML

Open http://localhost:5173 and view page source (Ctrl+U). You should see:
- `<div id="root"></div>`
- Script tags loading React

If you don't see these, the frontend server isn't running properly.

## Still Not Working?

Please provide:
1. Screenshot of browser console errors
2. Screenshot of Network tab
3. Output of: `curl http://localhost:5173`
4. Output of: `curl http://localhost:3001/health`

