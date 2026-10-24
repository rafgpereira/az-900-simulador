#!/usr/bin/env bash
# Inicia o Simulador AZ-900 em http://localhost:8900
cd "$(dirname "$0")"
PORT="${1:-8900}"
URL="http://localhost:$PORT"
echo "Simulador AZ-900 disponível em $URL  (Ctrl+C para encerrar)"
( sleep 1; command -v xdg-open >/dev/null && xdg-open "$URL" >/dev/null 2>&1 ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1
