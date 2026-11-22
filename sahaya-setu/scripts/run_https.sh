#!/usr/bin/env bash
# Run Sahaya Setu over HTTPS on your Wi-Fi so phones can use the camera, GPS and offline mode.
# Usage: bash scripts/run_https.sh            (then open https://<shown-ip>:8443 on the phone)
set -euo pipefail
cd "$(dirname "$0")/.."
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
IP=${IP:-$(ipconfig getifaddr en0 2>/dev/null || echo 127.0.0.1)}
mkdir -p certs
if [ ! -f certs/cert.pem ] || ! grep -q "$IP" certs/ip.txt 2>/dev/null; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 30 -keyout certs/key.pem -out certs/cert.pem \
    -subj "/CN=sahaya-setu" -addext "subjectAltName=IP:${IP},DNS:localhost" >/dev/null 2>&1
  echo "$IP" > certs/ip.txt
fi
echo "Open on the phone:  https://${IP}:8443/   (accept the certificate warning once)"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
