#!/usr/bin/env bash
#
# Genera una URL pública (HTTPS) para la beta local y la muestra destacada.
# Sin cuentas. Mantén esta terminal abierta mientras quieras el acceso remoto.
#
# Uso:
#   pnpm beta:tunnel
#   LOCAL_PORT=8080 bash scripts/tunnel.sh
#
set -euo pipefail

PORT="${LOCAL_PORT:-8080}"
LOG_FILE="${TMPDIR:-/tmp}/flota-tunnel.log"

CLOUDFLARED="$(command -v cloudflared || true)"
if [[ -z "${CLOUDFLARED}" && -x "${HOME}/.local/bin/cloudflared" ]]; then
  CLOUDFLARED="${HOME}/.local/bin/cloudflared"
fi

if [[ -n "${CLOUDFLARED}" ]]; then
  : > "${LOG_FILE}"
  "${CLOUDFLARED}" tunnel --url "http://localhost:${PORT}" --no-autoupdate \
    > "${LOG_FILE}" 2>&1 &
  CF_PID=$!
  trap 'kill "${CF_PID}" 2>/dev/null || true' INT TERM

  URL=""
  for _ in $(seq 1 40); do
    URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${LOG_FILE}" | head -1 || true)"
    [[ -n "${URL}" ]] && break
    sleep 1
  done

  if [[ -z "${URL}" ]]; then
    echo "No se pudo obtener la URL. Revisa ${LOG_FILE}." >&2
    exit 1
  fi

  echo
  echo "==================================================================="
  echo "  URL pública: ${URL}"
  echo "==================================================================="
  echo "  Comparte esta URL (o su QR). Mantén esta terminal abierta."
  echo "  Ctrl+C para cerrar el túnel."
  echo
  wait "${CF_PID}"
  exit 0
fi

if command -v ssh >/dev/null 2>&1; then
  echo "cloudflared no está instalado; usando localhost.run por SSH."
  echo "Copia la URL https://…lhr.life que aparezca."
  exec ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:"${PORT}" nokey@localhost.run
fi

echo "Instala cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) o usa ssh." >&2
exit 1
