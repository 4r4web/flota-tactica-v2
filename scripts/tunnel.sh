#!/usr/bin/env bash
#
# Expone la beta local con un túnel gratuito (sin cuentas).
#
# Uso:
#   LOCAL_PORT=8080 bash scripts/tunnel.sh
#
# Orden de preferencia:
#   1. cloudflared (quick tunnel)  -> https://<aleatorio>.trycloudflare.com
#   2. SSH a localhost.run         -> https://<aleatorio>.lhr.life
#
set -euo pipefail

PORT="${LOCAL_PORT:-8080}"

echo "==> Exponiendo http://localhost:${PORT}"

if command -v cloudflared >/dev/null 2>&1; then
  echo "Usando cloudflared (quick tunnel). Copia la URL https://…trycloudflare.com que aparezca."
  exec cloudflared tunnel --url "http://localhost:${PORT}"
fi

if command -v ssh >/dev/null 2>&1; then
  echo "cloudflared no está instalado; usando localhost.run por SSH."
  echo "Copia la URL https://…lhr.life que aparezca."
  exec ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:"${PORT}" nokey@localhost.run
fi

echo "Instala cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) o usa ssh." >&2
exit 1
