#!/bin/bash
cd "$(dirname "$0")"
python3 server.py &
server_pid=$!
sleep 1
open "http://127.0.0.1:8080"
wait "$server_pid"
