#!/bin/bash
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 is required so your notes can be saved in tracker-data.json."
    echo "Install it from https://www.python.org/downloads/ or run: brew install python3"
    read -r -p "Press Return to close."
    exit 1
fi

if [ ! -f neev.env ]; then
    echo "Ask is off until neev.env exists in this folder."
    echo "Copy neev.env.example to neev.env and set NEEV_CHAT_API_KEY."
fi

python3 server.py &
server_pid=$!

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sf -o /dev/null "http://127.0.0.1:8080/"; then
        ready=1
        break
    fi
    sleep 0.3
done

if [ "$ready" -ne 1 ]; then
    echo "The app did not start. If another window is already using port 8080, close it and try again."
    kill "$server_pid" 2>/dev/null
    read -r -p "Press Return to close."
    exit 1
fi

open "http://127.0.0.1:8080"
echo "Notes are saved in tracker-data.json in this folder."
echo "Press Ctrl+C to stop."
wait "$server_pid"
