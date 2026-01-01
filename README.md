# Zero-Stress Sales™ - Closer Co-Pilot

Real-time AI-powered sales conversation analysis system that listens to conversations and provides live insights based on the Zero-Stress Sales methodology.

## Project Structure

```
zero-stress-sales-main/
├── backend/              # Backend server (Node.js/Express/WebSocket)
│   ├── src/
│   │   ├── data/        # CSV parsing
│   │   ├── services/    # AI analysis services (6 parallel models)
│   │   ├── types/       # TypeScript types
│   │   ├── websocket.ts
│   │   └── index.ts
│   ├── package.json
│   └── .env
│
├── frontend/             # Frontend application (React/TypeScript)
│   ├── src/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── data/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── ...
│
├── supabase/             # Database migrations
├── *.csv                 # Sales logic CSV files (shared, used by backend)
└── *.sh                  # Startup scripts
```

## Features

- **Real-time Conversation Analysis**: AI listens and analyzes sales conversations in real-time
- **7-Pillar Assessment System**: Comprehensive evaluation across 27 indicators
- **Lubometer™ Scoring**: Calculates buyer readiness across price tiers
- **Truth Index™**: Detects inconsistencies and authenticity in prospect responses
- **Objection Detection**: Identifies and provides scripts for handling objections
- **Psychological Dials**: Analyzes top psychological patterns
- **Red Flags Detection**: Warns about potential risks or inconsistencies

## Quick Start

### Option 1: Use Start Script (Recommended)

```bash
./START_SERVERS.sh
```

This will start both backend and frontend automatically.

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm install  # First time only
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install  # First time only
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Backend Health Check**: http://localhost:3001/health

## First Time Setup

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
WS_PORT=3001
NODE_ENV=development
EOF

npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Deployment / Hosting

When deploying to a hosting service (Vercel, Railway, Render, Heroku, etc.):

### Backend Environment Variables

Set these environment variables in your hosting platform's dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Your OpenAI API key |
| `PORT` | No | Server port (default: 3001) |
| `NODE_ENV` | No | Set to `production` for production |

### Frontend Environment Variables (Optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_WS_URL` | No | WebSocket URL (auto-detected if not set) |

### Important Notes

1. The `.env` file is NOT committed to Git for security reasons
2. You must set `OPENAI_API_KEY` in your hosting platform's environment variables
3. The frontend automatically detects the WebSocket URL based on the current domain

## CSV Files

The system uses CSV files in the project root that define the sales logic:
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillars.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 1.csv` through `Pillar 7.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Lubometer Formula.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Truth Index.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Indicators and Objection Matrix.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Hot Buttons Tracker.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Push_Delay Rules.csv`

## Development

### Backend Structure
```
backend/
├── src/
│   ├── data/
│   │   ├── csvParser.ts       # CSV file parsing
│   │   └── csvTypes.ts        # Type definitions
│   ├── services/
│   │   ├── analysisEngine.ts  # Main orchestrator
│   │   ├── indicatorScorer.ts
│   │   ├── pillarCalculator.ts
│   │   ├── lubometerCalculator.ts
│   │   ├── truthIndexCalculator.ts
│   │   ├── objectionDetector.ts
│   │   ├── psychologicalDialsAnalyzer.ts
│   │   ├── redFlagsDetector.ts
│   │   └── audioService.ts
│   ├── types/
│   │   └── analysis.ts        # Analysis result types
│   ├── websocket.ts           # WebSocket server
│   └── index.ts               # Express server
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/            # React components
│   ├── lib/                   # Utilities (WebSocket client, Supabase)
│   ├── data/                  # Mock data
│   ├── types.ts               # TypeScript types
│   ├── App.tsx                # Main app component
│   └── main.tsx               # Entry point
```

## Stopping Servers

```bash
./STOP_SERVERS.sh
```

Or manually:
```bash
pkill -f "tsx watch.*backend"
pkill -f "vite"
```

## Troubleshooting

See `TROUBLESHOOT.md` for detailed troubleshooting steps.

Common issues:
- **Blank screen**: Check browser console (F12) for errors
- **WebSocket connection fails**: Ensure backend is running first
- **Port already in use**: Stop existing servers or change ports

## License

Copyright © 2024 Zero-Stress Sales™. All rights reserved.
