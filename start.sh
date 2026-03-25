#!/bin/bash
# Start backend on port 3001 in background
tsx server/index.ts &
echo "Backend started (pid $!)"

# Start Vite frontend on port 8080 (reads vite.config.ts)
exec vite
