#!/bin/bash

# Zero-Stress Sales - Start Script
# This script starts both backend and frontend servers

echo "🚀 Starting Zero-Stress Sales Application..."
echo ""

# Check if .env exists in backend directory
if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env file not found!"
    echo "Please create backend/.env with your OPENAI_API_KEY"
    exit 1
fi

# Start backend server
echo "📦 Starting backend server..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
sleep 3

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ Backend server is running on http://localhost:3001"
else
    echo "❌ Backend server failed to start. Check backend.log for errors."
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend server
echo ""
echo "🎨 Starting frontend server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

# Wait for frontend to start
echo "⏳ Waiting for frontend to start..."
sleep 5

# Check if frontend is running
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Frontend server is running on http://localhost:5173"
    echo ""
    echo "🎉 Application is ready!"
    echo ""
    echo "📍 Backend:  http://localhost:3001"
    echo "📍 Frontend: http://localhost:5173"
    echo ""
    echo "Press Ctrl+C to stop both servers"
    echo "Backend logs: tail -f backend.log"
    echo "Frontend logs: tail -f frontend.log"
    echo ""
    
    # Wait for user interrupt
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
    wait
else
    echo "❌ Frontend server failed to start. Check frontend.log for errors."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi


