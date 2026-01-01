# Project Structure

The project is now organized with clear separation between backend and frontend:

```
zero-stress-sales-main/
├── backend/ (server/)
│   ├── src/
│   │   ├── data/              # CSV parsing
│   │   ├── services/          # Analysis services
│   │   ├── types/             # TypeScript types
│   │   ├── websocket.ts       # WebSocket server
│   │   └── index.ts           # Express server
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                   # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities (WebSocket, Supabase)
│   │   ├── data/              # Mock data
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── package.json
│   └── node_modules/
│
├── supabase/                  # Database migrations
│   └── migrations/
│
├── *.csv                      # Sales logic CSV files (shared)
│
└── *.sh                       # Startup scripts
    ├── START_SERVERS.sh
    └── STOP_SERVERS.sh
```

## Backend (server/)

Located in `server/` directory:
- Node.js/Express server
- WebSocket server
- Analysis engine
- CSV parsing logic
- Runs on port 3001

## Frontend

Located in `frontend/` directory:
- React + TypeScript application
- Vite build tool
- Tailwind CSS
- Runs on port 5173

## Shared Files

Files in the root directory:
- CSV files (used by backend)
- Documentation files (*.md)
- Startup scripts (*.sh)
