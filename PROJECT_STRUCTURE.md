# Project Structure - Zero-Stress Sales

The project has been reorganized with clear separation between backend and frontend code.

## Directory Structure

```
zero-stress-sales-main/
│
├── server/                    # Backend Server
│   ├── src/
│   │   ├── data/             # CSV file parsing
│   │   ├── services/         # Analysis services
│   │   ├── types/            # TypeScript types
│   │   ├── websocket.ts      # WebSocket server
│   │   └── index.ts          # Express server entry point
│   ├── dist/                 # Compiled JavaScript (generated)
│   ├── node_modules/         # Backend dependencies
│   ├── package.json          # Backend dependencies
│   ├── tsconfig.json         # TypeScript config for backend
│   ├── .env                  # Environment variables (create this)
│   └── README.md             # Backend documentation
│
├── frontend/                  # Frontend Application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities (WebSocket client, Supabase)
│   │   ├── data/             # Mock data
│   │   ├── App.tsx           # Main app component
│   │   ├── main.tsx          # Entry point
│   │   ├── types.ts          # TypeScript types
│   │   └── index.css         # Global styles
│   ├── dist/                 # Production build (generated)
│   ├── node_modules/         # Frontend dependencies
│   ├── index.html            # HTML entry point
│   ├── package.json          # Frontend dependencies
│   ├── vite.config.ts        # Vite configuration
│   ├── tsconfig.json         # TypeScript config
│   ├── tsconfig.app.json     # App-specific TS config
│   ├── tsconfig.node.json    # Node-specific TS config
│   ├── tailwind.config.js    # Tailwind CSS config
│   ├── postcss.config.js     # PostCSS config
│   └── eslint.config.js      # ESLint config
│
├── supabase/                  # Database
│   └── migrations/           # Database migration files
│
├── *.csv                      # Sales logic CSV files (shared by backend)
│   ├── Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillars.csv
│   ├── Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 1.csv
│   └── ... (other CSV files)
│
└── *.sh                       # Startup scripts
    ├── START_SERVERS.sh      # Start both servers
    └── STOP_SERVERS.sh       # Stop both servers
```

## Quick Commands

### Start Application
```bash
./START_SERVERS.sh
```

### Stop Application
```bash
./STOP_SERVERS.sh
```

### Manual Start

**Backend:**
```bash
cd server
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## Key Points

1. **Backend** (`server/`): All server-side code, runs on port 3001
2. **Frontend** (`frontend/`): All client-side code, runs on port 5173
3. **CSV Files** (root): Shared by backend for sales logic
4. **Scripts** (root): Convenience scripts to manage both servers

Each directory (`server/` and `frontend/`) has its own:
- `package.json` and `node_modules/`
- TypeScript configuration
- Build outputs

This separation makes it easy to:
- Deploy backend and frontend separately
- Work on each part independently
- Scale each part separately
- Have different dependencies for each
