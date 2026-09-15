#!/usr/bin/env bash
#
# Muestra las partidas de prueba registradas en la base de datos.
# Ejecutar desde la raíz del repositorio, con el stack en marcha:
#
#   bash scripts/matches.sh            # últimas partidas y jugadores
#   bash scripts/matches.sh <gameId>   # acciones de una partida concreta
#
set -euo pipefail

if [[ ! -f .env.prod ]]; then
  echo "No encuentro .env.prod. Ejecuta este script desde la raíz del repositorio." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env.prod; set +a
PGUSER="${POSTGRES_USER:-flota}"
PGDB="${POSTGRES_DB:-flota}"

COMPOSE=(docker compose --env-file .env.prod -f docker/compose.tunnel.yml)
psql() { "${COMPOSE[@]}" exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -c "$1"; }

if [[ $# -ge 1 ]]; then
  GAME_ID="$1"
  echo "=== Acciones de la partida ${GAME_ID} ==="
  psql "select seq, turn, type, payload from game_events where game_id = '${GAME_ID}' order by seq;"
  exit 0
fi

echo "=== Últimas partidas ==="
psql "select g.id, g.created_at, g.status, g.mode, coalesce(u.display_name,'-') as ganador
      from games g left join users u on u.id = g.winner_user_id
      order by g.created_at desc limit 15;"

echo "=== Jugadores por partida ==="
psql "select g.created_at, gp.role, u.display_name, gp.result
      from games g
      join game_players gp on gp.game_id = g.id
      join users u on u.id = gp.user_id
      order by g.created_at desc limit 20;"

echo "Tip: para ver las acciones de una partida: bash scripts/matches.sh <gameId>"
