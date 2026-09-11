# Flota Táctica v2

Juego táctico naval por turnos para 2 jugadores. Re-implementación con arquitectura de **servidor central autoritativo** y **frontend instalable (PWA)**.

## Documentación

| Documento | Contenido |
|---|---|
| [Especificación del juego](docs/especificacion-juego.md) | Reglas, dinámica, interfaz y protocolo del prototipo 0.1 |
| [01 — Decisiones (ADR)](docs/01-decisiones.md) | Registro de decisiones de arquitectura y proceso |
| [02 — SDLC](docs/02-sdlc.md) | Metodología Kanban, sprints, calidad y CI/CD |
| [03 — Arquitectura](docs/03-arquitectura.md) | Componentes, frontera de autoridad, flujo de datos |
| [04 — Modelo de datos](docs/04-modelo-datos.md) | Esquema PostgreSQL (Drizzle) y claves Redis |
| [05 — Protocolo](docs/05-protocolo.md) | Contrato REST/WebSocket con esquemas Zod |
| [06 — Roadmap](docs/06-roadmap.md) | Fases, hitos y criterios de salida |
| [07 — Despliegue](docs/07-despliegue.md) | Docker, Caddy, CD, backups y operación |
| [08 — Beta gratuita](docs/08-beta-gratuita.md) | Despliegue con coste 0 (Oracle Cloud Always Free) |
| [09 — Beta sin cuentas](docs/09-beta-sin-cuentas.md) | Túnel local y alternativas sin registros |
| [10 — Beta en Raspberry Pi](docs/10-beta-raspberry-pi.md) | Beta autoalojada en una Raspberry Pi |

## Estructura

```
apps/
  server/     API REST + WebSocket + motor autoritativo
  web/        PWA React + Vite
packages/
  domain/     Reglas puras del juego (sin I/O)
  protocol/   Esquemas Zod y tipos de mensajes
  config/     tsconfig y configuración compartida
docker/       PostgreSQL + Redis para desarrollo
docs/         Documentación
```

## Puesta en marcha

Requisitos: **Node ≥ 22.13** y **pnpm** (vía `corepack enable`).

```bash
pnpm install        # instalar dependencias
pnpm db:up          # levantar PostgreSQL y Redis (Docker)
pnpm dev            # servidor y web en modo desarrollo
pnpm build          # compilar todos los paquetes y apps
pnpm test           # pruebas unitarias e integración
pnpm test:e2e       # pruebas end-to-end (Playwright)
pnpm lint           # análisis estático
pnpm typecheck      # comprobación de tipos
pnpm format         # formateo de código
```

Despliegue en producción (ver [guía de despliegue](docs/07-despliegue.md)):

```bash
docker compose --env-file .env.prod -f docker/compose.prod.yml up -d
```

Para la **beta con coste 0**:

- **Sin crear cuentas:** [túnel local](docs/09-beta-sin-cuentas.md) → `cp .env.prod.example .env.prod`, `pnpm beta:up`, `pnpm beta:migrate`, `pnpm beta:tunnel`.
- **Autoalojada en una Raspberry Pi:** [guía de Raspberry Pi](docs/10-beta-raspberry-pi.md).
- **En la nube gratuita:** [Oracle Cloud Always Free](docs/08-beta-gratuita.md).

Prueba de carga (requiere [k6](https://k6.io)):

```bash
k6 run -e BASE_URL=http://localhost:3000 tests/load/match.js
```

- Servidor de desarrollo: http://localhost:3000 (`GET /health`)
- Cliente de desarrollo: http://localhost:5173 (proxy a `/api` y `/ws`)

Para jugar en local: `pnpm db:up`, `pnpm --filter @flota/server exec drizzle-kit migrate` y
`pnpm dev` (arranca servidor y web). Abre http://localhost:5173, regístrate y crea o únete a una sala.

## Resumen técnico

- **Stack:** TypeScript · Node.js · React 19 + Vite · PostgreSQL + Redis · Drizzle · WebSocket · Zod
- **Estructura:** monorepo con pnpm workspaces
- **Seguridad:** JWT + Argon2, rate limiting, helmet, validación estricta
- **Observabilidad:** logs estructurados (pino) y métricas Prometheus (`/metrics`)
- **Despliegue:** VPS con Docker Compose y reverse proxy con TLS (Caddy), CD a GHCR
- **Metodología:** Kanban con sprints cortos

## Estado

| Fase | Estado |
|---|---|
| 0 — Fundaciones | ✅ Completada |
| 1 — Dominio y protocolo | ✅ Completada |
| 2 — Servidor autoritativo | ✅ Completada |
| 3 — Cliente PWA | ✅ Completada |
| 4 — Matchmaking y ciclo | ✅ Completada |
| 5 — Endurecimiento y despliegue | ✅ Completada |
| 6 — Lanzamiento | ⏳ Próxima |

El servidor autoritativo ofrece registro/login (email + JWT), salas privadas, matchmaking, el bucle de partida completo por WebSocket y el **ciclo de vida** (presencia del rival, abandono y reanudación tras recargar). La **PWA** (`apps/web`) cubre registro/login, lobby, construcción y colocación de flota, tablero 10×10, command deck, reglas, reconexión y manejo de errores tipados. Hay pruebas **E2E con Playwright** de los flujos críticos.

## Demo de partida (sin frontend)

Con PostgreSQL y Redis en marcha:

```bash
pnpm db:up
pnpm --filter @flota/server exec drizzle-kit migrate
pnpm --filter @flota/server dev          # terminal 1
pnpm --filter @flota/server demo:match   # terminal 2
```

La demo registra dos jugadores, crea una sala privada, prepara ambas flotas y juega una partida completa por WebSocket imprimiendo cada hundimiento.

## Cómo contribuir

Consulta la [metodología](docs/02-sdlc.md): ramas cortas, Conventional Commits, PR revisada y CI en verde.
