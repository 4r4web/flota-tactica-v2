#!/usr/bin/env bash
#
# Puesta en marcha de la beta en un PC con Ubuntu (o cualquier Linux con apt).
# Ejecutar desde la raíz del repositorio:
#
#   git clone https://github.com/4r4web/flota-tactica-v2.git
#   cd flota-tactica-v2
#   bash scripts/setup-home.sh
#
set -euo pipefail

if [[ ! -f docker/compose.tunnel.yml ]]; then
  echo "Ejecuta este script desde la raíz del repositorio flota-tactica-v2." >&2
  exit 1
fi

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker"
  sudo bash scripts/bootstrap-docker.sh
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  DOCKER=(sudo docker)
fi

COMPOSE=("${DOCKER[@]}" compose --env-file .env.prod -f docker/compose.tunnel.yml)

# 2. Entorno
if [[ ! -f .env.prod ]]; then
  echo "==> Creando .env.prod con secretos aleatorios"
  umask 077
  cat > .env.prod <<EOF
# Entorno de la beta (generado automáticamente). NO se sube a git.
DOMAIN=localhost
CORS_ORIGIN=*
POSTGRES_USER=flota
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=flota
JWT_SECRET=$(openssl rand -hex 32)
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_TTL=604800
LOCAL_BIND=0.0.0.0
LOCAL_PORT=8080
EOF
  chmod 600 .env.prod
fi

# 3. Construir y levantar
echo "==> Construyendo y levantando el stack (la primera vez tarda unos minutos)"
"${COMPOSE[@]}" up -d --build

# 4. Migraciones
echo "==> Aplicando migraciones"
"${COMPOSE[@]}" run --rm server node dist/db/migrate.js

# 5. Resumen
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "==============================================================="
echo "  Beta en marcha."
echo "  Local:  http://localhost:8080"
[[ -n "${IP}" ]] && echo "  Red:    http://${IP}:8080"
echo "  Estado: http://localhost:8080/status"
echo "---------------------------------------------------------------"
echo "  Acceso desde fuera (túnel):  bash scripts/tunnel.sh"
echo "  URL fija (recomendado):      bash scripts/funnel-tailscale.sh"
echo "  Ver logs:                    ${DOCKER[*]} compose --env-file .env.prod -f docker/compose.tunnel.yml logs -f server"
echo "  Parar:                       ${DOCKER[*]} compose --env-file .env.prod -f docker/compose.tunnel.yml down"
echo "==============================================================="
