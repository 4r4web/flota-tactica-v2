#!/usr/bin/env bash
#
# Instala Docker + Compose en Debian/Ubuntu/Raspberry Pi OS.
#
# Uso:  sudo bash scripts/bootstrap-docker.sh
#
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este script con sudo." >&2
  exit 1
fi

echo "==> Instalando dependencias base"
apt-get update
apt-get install -y ca-certificates curl git

echo "==> Instalando Docker (script oficial)"
curl -fsSL https://get.docker.com | sh

systemctl enable --now docker

if [[ -n "${SUDO_USER:-}" ]]; then
  usermod -aG docker "${SUDO_USER}"
  echo "Añadido ${SUDO_USER} al grupo docker (cierra y reabre la sesión para usarlo sin sudo)."
fi

echo
echo "Docker instalado:"
docker --version
docker compose version
