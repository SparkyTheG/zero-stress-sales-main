# Debugging Blank Screen Issue

If you see a blank screen in the browser, follow these steps:

## 1. Check Browser Console

Open Developer Tools (F12 or Right-click → Inspect) and check the Console tab for errors.

Common errors:
- WebSocket connection errors (these are OK - app will use mock data)
- Module import errors
- TypeScript/JavaScript runtime errors

## 2. Check Network Tab

In Developer Tools → Network tab:
- Check if `index.html` loads (should return 200)
- Check if JavaScript files load
- Check if CSS files load

## 3. Verify Servers Are Running

```bash
# Check backend
curl http://localhost:3001/health

# Check frontend
curl http://localhost:5173
```

## 4. Restart Servers

```bash
# Stop servers
./STOP_SERVERS.sh

# Start servers
./START_SERVERS.sh
```

## 5. Check Logs

```bash
# Backend logs
tail -f backend.log

# Frontend logs (if using start script)
tail -f frontend.log

# Or check Vite output directly
cd /home/sparky/Documents/zero-stress-sales-main
npm run dev
```

## 6. Clear Browser Cache

- Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
- Or clear browser cache completely

## 7. Test in Incognito/Private Mode

This helps rule out browser extension issues.

## 8. Verify Files Exist

```bash
cd /home/sparky/Documents/zero-stress-sales-main
ls -la src/main.tsx
ls -la src/App.tsx
ls -la index.html
```

All should exist and be readable.

## 9. Rebuild Frontend

```bash
cd /home/sparky/Documents/zero-stress-sales-main
rm -rf node_modules/.vite
npm run build
npm run dev
```

## Expected Console Output

When the app loads correctly, you should see in the browser console:
```
WebSocket client initialized
WebSocket connected (or connection error - both are OK)
```

The app will work with mock data even if WebSocket fails to connect.

