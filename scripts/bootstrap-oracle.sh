#!/usr/bin/env bash
#
# Prepara una VM Ubuntu (Oracle Cloud Always Free ARM) para la beta:
# instala Docker + Compose y abre los puertos 80/443 en el firewall local.
#
# Uso:  sudo bash scripts/bootstrap-oracle.sh
#
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este script con sudo." >&2
  exit 1
fi

echo "==> Instalando dependencias base"
apt-get update
apt-get install -y ca-certificates curl gnupg git iptables-persistent

echo "==> Añadiendo el repositorio oficial de Docker"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# shellcheck disable=SC1091
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable --now docker

echo "==> Abriendo los puertos 80 y 443 en iptables"
# Las imágenes Ubuntu de Oracle traen una regla REJECT por defecto.
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
netfilter-persistent save

echo
echo "Listo. Pasos siguientes:"
echo "  1. Abre los puertos 80 y 443 (TCP) en la Security List / NSG de Oracle."
echo "  2. Clona el repositorio y entra en él."
echo "  3. cp .env.prod.example .env.prod  y edita DOMAIN, CORS_ORIGIN, POSTGRES_PASSWORD y JWT_SECRET."
echo "  4. docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build"
echo "  5. docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js"
