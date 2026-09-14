#!/usr/bin/env bash
#
# URL fija y gratuita para la beta usando Tailscale Funnel.
# Sin dominio y sin abrir puertos en el router.
#
# Uso:
#   bash scripts/funnel-tailscale.sh
#   LOCAL_PORT=8080 bash scripts/funnel-tailscale.sh
#
set -euo pipefail

PORT="${LOCAL_PORT:-8080}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "==> Instalando Tailscale"
  curl -fsSL https://tailscale.com/install.sh | sh
fi

echo "==> Conectando a Tailscale (si no lo estás, se abrirá el navegador para iniciar sesión)"
sudo tailscale up

echo "==> Habilitando Funnel para el puerto ${PORT}"
sudo tailscale funnel --bg "${PORT}"

echo
echo "==================================================================="
sudo tailscale funnel status || true
echo "==================================================================="
echo "  Esa URL https://<equipo>.<tailnet>.ts.net es FIJA."
echo "  Mantén el PC encendido. Para desactivar: sudo tailscale funnel --bg off"
echo
