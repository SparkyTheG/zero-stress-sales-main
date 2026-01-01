# How to Run Zero-Stress Sales Application

## Quick Start (Easiest Method)

### Option 1: Use the Start Script (Recommended)
```bash
./START_SERVERS.sh
```

This will start both backend and frontend automatically.

To stop:
```bash
./STOP_SERVERS.sh
```

---

## Manual Start (Two Terminal Windows)

### Terminal 1 - Backend Server
```bash
cd backend
npm run dev
```

Backend will run on: **http://localhost:3001**

### Terminal 2 - Frontend Server
```bash
npm run dev
```

Frontend will run on: **http://localhost:5173**

---

## First Time Setup

1. **Install Backend Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   
   Create `backend/.env` file:
   ```bash
   cd backend
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   echo "PORT=3001" >> .env
   echo "WS_PORT=3001" >> .env
   echo "NODE_ENV=development" >> .env
   ```
   
   Replace `your_openai_api_key_here` with your actual OpenAI API key.

---

## Verify Everything is Working

1. **Check Backend:**
   ```bash
   curl http://localhost:3001/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check Frontend:**
   Open browser: http://localhost:5173

3. **Test WebSocket Connection:**
   - Open browser console on the frontend
   - You should see WebSocket connection messages
   - The frontend will automatically connect to the backend

---

## Troubleshooting

### Backend won't start
- Check that `backend/.env` exists with OPENAI_API_KEY
- Check port 3001 is not in use: `lsof -i :3001`
- Check logs: `tail -f backend.log` (if using start script)

### Frontend won't start
- Check port 5173 is not in use: `lsof -i :5173`
- Reinstall dependencies: `npm install`
- Check logs: `tail -f frontend.log` (if using start script)

### WebSocket connection fails
- Ensure backend is running first
- Check browser console for errors
- Verify backend WebSocket server started (check backend logs)

### CSV files not loading
- Ensure all CSV files are in the project root directory
- Check that file names match exactly (case-sensitive)

---

## Development Commands

### Backend
```bash
cd backend
npm run dev      # Start with hot reload
npm run build    # Build TypeScript
npm start        # Run production build
```

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

---

## Ports Used

- **Backend HTTP/WebSocket**: 3001
- **Frontend Dev Server**: 5173 (Vite default)

To change ports, modify:
- Backend: `backend/.env` (PORT variable)
- Frontend: `vite.config.ts` (server.port)

---

## Current Status

✅ Backend server running on port 3001
✅ Frontend server ready on port 5173
✅ WebSocket connection working
✅ CSV files loading correctly (7 pillars, 27 indicators)
✅ Analysis engine functional


