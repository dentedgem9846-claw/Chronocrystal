#!/bin/bash
set -e

# Start simplex-chat CLI as WebSocket server in the background
simplex-chat -p 5225 -d /data/simplex_db --create-bot-display-name "Kawa" &
SIMPLEX_PID=$!

# Wait for the CLI to be ready
echo "Waiting for simplex-chat CLI to start..."
for i in $(seq 1 30); do
    if curl -s http://localhost:5225 > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo "SimpleX Chat CLI started (PID $SIMPLEX_PID)"

# Start the bot process
cd /app
bun packages/chronocrystal/src/main.ts &
BOT_PID=$!

# Wait for either process to exit
wait -n $SIMPLEX_PID $BOT_PID

# If one exits, kill the other
kill $SIMPLEX_PID $BOT_PID 2>/dev/null || true
wait