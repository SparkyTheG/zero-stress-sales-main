#!/bin/bash

# Zero-Stress Sales - Stop Script
# This script stops both backend and frontend servers

echo "🛑 Stopping Zero-Stress Sales servers..."

# Kill backend processes
pkill -f "tsx watch.*backend/src/index.ts" && echo "✅ Backend stopped" || echo "⚠️  Backend not running"

# Kill frontend processes
pkill -f "vite.*zero-stress" && echo "✅ Frontend stopped" || echo "⚠️  Frontend not running"

# Kill any node processes on ports 3001 and 5173
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo ""
echo "✅ All servers stopped"


