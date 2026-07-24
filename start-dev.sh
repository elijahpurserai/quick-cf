#!/bin/bash

# Kill all background processes started by this script on exit
trap "kill 0" EXIT

echo "🧹 Cleaning up old processes..."
# Kill any existing processes on our dev ports (use -9 to handle stopped/zombie processes)
for port in 3001 5173 5174; do
  pids=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "   Killing process(es) on port $port (PID: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null
    sleep 0.5
  fi
done

echo "🚀 Starting Quick Development Environment..."

# Start Backend Server
echo "📡 Launching Backend Server (Port 3001)..."
(cd server && npm run dev) &

# Start Frontend Website
echo "💻 Launching Frontend Website..."
(cd website && npm run dev) &

echo "✨ Both services are starting. Press Ctrl+C to stop both."

# Wait for background processes to keep the script running
wait
