#!/bin/bash
set -e

# Start simplex-chat CLI as WebSocket server in the background
simplex-chat -y -p 5225 -d /data/simplex_db --create-bot-display-name "Kawa" &
SIMPLEX_PID=$!

# Wait for the CLI to initialize (simplex-chat needs time to start WebSocket server)
echo "Waiting for simplex-chat CLI to start..."
sleep 5

# Check if simplex-chat is still running
if ! kill -0 $SIMPLEX_PID 2>/dev/null; then
    echo "ERROR: simplex-chat failed to start"
    exit 1
fi
echo "SimpleX Chat CLI started (PID $SIMPLEX_PID)"

# Start the bot process (includes health check server on port 8080)
cd /app
bun packages/chronocrystal/src/main.ts &
BOT_PID=$!

# Wait for either process to exit
wait -n $SIMPLEX_PID $BOT_PID

# If one exits, kill the other
kill $SIMPLEX_PID $BOT_PID 2>/dev/null || true
wait