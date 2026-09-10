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
pnpm lint           # análisis estático
pnpm typecheck      # comprobación de tipos
pnpm format         # formateo de código
```

- Servidor de desarrollo: http://localhost:3000 (`GET /health`)
- Cliente de desarrollo: http://localhost:5173 (proxy a `/api` y `/ws`)

Para jugar en local: `pnpm db:up`, `pnpm --filter @flota/server exec drizzle-kit migrate` y
`pnpm dev` (arranca servidor y web). Abre http://localhost:5173, regístrate y crea o únete a una sala.

## Resumen técnico

- **Stack:** TypeScript · Node.js · React 19 + Vite · PostgreSQL + Redis · Drizzle · WebSocket · Zod
- **Estructura:** monorepo con pnpm workspaces
- **Despliegue:** VPS con Docker Compose y reverse proxy con TLS
- **Metodología:** Kanban con sprints cortos

## Estado

| Fase | Estado |
|---|---|
| 0 — Fundaciones | ✅ Completada |
| 1 — Dominio y protocolo | ✅ Completada |
| 2 — Servidor autoritativo | ✅ Completada |
| 3 — Cliente PWA | ✅ Completada |
| 4 — Matchmaking y ciclo | ⏳ Próxima |
| 5 — Endurecimiento y despliegue | Pendiente |
| 6 — Lanzamiento | Pendiente |

El servidor autoritativo ofrece registro/login (email + JWT), salas privadas, matchmaking y el bucle de partida completo por WebSocket, con persistencia en PostgreSQL y estado en Redis. La **PWA** (`apps/web`) cubre registro/login, lobby, construcción y colocación de flota, tablero 10×10, command deck, reglas, reconexión y manejo de errores tipados.

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
