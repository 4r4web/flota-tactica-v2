# 07 — Despliegue y Operación

Guía para desplegar Flota Táctica v2 en un VPS con Docker. Complementa los ADR-024 y ADR-025.

---

## 1. Arquitectura de despliegue

```
Internet ──HTTPS──► Caddy (TLS) ──┬── /api/*  ──► server:3000
                                   ├── /ws     ──► server:3000
                                   └── /*      ──► web:80 (nginx, PWA)
server ──► postgres:5432
       ──► redis:6379
```

- **Caddy** termina TLS (Let's Encrypt) y enruta.
- **web** sirve la PWA estática con fallback SPA.
- **server** expone REST y WebSocket.
- **postgres** y **redis** son internos (no publican puertos).

---

## 2. Requisitos del VPS

- Docker Engine y el plugin `docker compose`.
- Un dominio apuntando a la IP del VPS (para TLS automático).
- Puertos **80** y **443** abiertos.

---

## 3. Primer despliegue

```bash
# En el VPS, dentro del directorio del proyecto
cp .env.prod.example .env.prod
# Edita .env.prod: DOMAIN, CORS_ORIGIN, POSTGRES_PASSWORD, JWT_SECRET

# Inicia sesión en GHCR (una vez)
echo "$GHCR_TOKEN" | docker login ghcr.io -u <usuario> --password-stdin

# Descarga imágenes, migra y arranca
docker compose --env-file .env.prod -f docker/compose.prod.yml pull
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
docker compose --env-file .env.prod -f docker/compose.prod.yml up -d
```

Comprueba: `curl https://<DOMAIN>/health`.

---

## 4. Despliegue continuo

El workflow `.github/workflows/deploy.yml` se ejecuta al integrar en `main`:

1. Construye y publica `flota-server` y `flota-web` en GHCR (etiquetas `latest` y `sha`).
2. Por SSH en el VPS: `pull`, migración y `up -d`.

**Secretos necesarios en GitHub:**

| Secreto | Descripción |
|---|---|
| `VPS_HOST` | IP o host del VPS |
| `VPS_USER` | Usuario SSH |
| `VPS_SSH_KEY` | Clave privada SSH |
| `VPS_PATH` | Directorio del proyecto en el VPS |

El VPS debe poder autenticarse en GHCR. El workflow usa `GITHUB_TOKEN`; si el VPS es privado, crea un token de solo lectura de paquetes.

---

## 5. Migraciones

Las migraciones viven en `apps/server/drizzle` y se aplican con:

```bash
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
```

Se ejecutan **antes** de levantar la nueva versión. Las migraciones deben ser compatibles hacia atrás durante la transición.

---

## 6. Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NODE_ENV` | Entorno | `production` |
| `PORT` | Puerto del servidor | `3000` |
| `DATABASE_URL` | Cadena de PostgreSQL | `postgres://user:pass@postgres:5432/flota` |
| `REDIS_URL` | Cadena de Redis | `redis://redis:6379` |
| `JWT_SECRET` | Secreto de firma (largo y aleatorio) | — |
| `ACCESS_TOKEN_TTL` | Vida del access token (s) | `900` |
| `REFRESH_TOKEN_TTL` | Vida del refresh token (s) | `604800` |
| `CORS_ORIGIN` | Origen(es) permitidos (coma-separados) | `https://flota.example.com` |
| `RATE_LIMIT_MAX` | Límite global por ventana | `120` |
| `RATE_LIMIT_WINDOW` | Ventana de rate limit | `1 minute` |
| `AUTH_RATE_LIMIT_MAX` | Límite en auth por ventana | `10` |
| `BODY_LIMIT` | Tamaño máximo del cuerpo (bytes) | `16384` |

---

## 7. Observabilidad

- **Salud:** `GET /health` verifica PostgreSQL y Redis.
- **Métricas:** `GET /metrics` (formato Prometheus). Restringe el acceso en Caddy en producción:

```
@metrics path /metrics
handle @metrics {
  respond 403
}
```

- **Logs:** JSON estructurado con `pino`; los campos sensibles (`authorization`, `password`, tokens) se redactan.

---

## 8. Copias de seguridad

- **PostgreSQL:** `pg_dump` diario y retención de 30 días; prueba de restauración periódica.

```bash
docker compose -f docker/compose.prod.yml exec postgres \
  pg_dump -U flota flota | gzip > backup-$(date +%F).sql.gz
```

- **Redis:** persistencia AOF; el estado en vivo es efímero y reconstruible.

---

## 9. Actualizaciones y reversión

```bash
# Desplegar una versión concreta
SERVER_IMAGE=ghcr.io/4r4web/flota-server:<sha> \
WEB_IMAGE=ghcr.io/4r4web/flota-web:<sha> \
docker compose --env-file .env.prod -f docker/compose.prod.yml up -d
```

Para revertir, fija las imágenes al commit anterior. Las migraciones deben planificarse para ser reversibles o compatibles.

---

## 10. Lista de seguridad

- [ ] `JWT_SECRET` largo y aleatorio, distinto por entorno.
- [ ] `POSTGRES_PASSWORD` robusto; PostgreSQL no publicado.
- [ ] `CORS_ORIGIN` restringido al dominio real.
- [ ] `/metrics` restringido en el proxy.
- [ ] TLS activo (Caddy) y HSTS.
- [ ] Backups de PostgreSQL probados.
- [ ] Actualizaciones de seguridad del sistema operativo.
- [ ] Política de privacidad y borrado de cuenta (`DELETE /me`).
