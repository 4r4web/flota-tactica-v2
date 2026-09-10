# 03 — Arquitectura Técnica

Documento de referencia de la arquitectura de Flota Táctica v2. Complementa las decisiones registradas en `01-decisiones.md` y el contrato de comunicación de `05-protocolo.md`.

---

## 1. Visión general

Arquitectura **cliente-servidor autoritativa**. El servidor posee el estado completo de la partida y valida todas las reglas; el cliente es una PWA que envía intenciones y renderiza las vistas filtradas que el servidor le envía.

```
                        ┌─────────────────────────────────────────────┐
                        │                 VPS (Docker)                 │
                        │                                             │
   ┌──────────┐  HTTPS  │  ┌────────────┐        ┌───────────────┐   │
   │  PWA     │◄───────►│  │  Reverse   │        │  PostgreSQL   │   │
   │  (React) │  WSS    │  │  Proxy     │        │  (Drizzle)    │   │
   └──────────┘         │  │ (Caddy/    │        └───────┬───────┘   │
                        │  │  nginx)    │                │           │
   ┌──────────┐  HTTPS  │  └─────┬──────┘        ┌───────┴───────┐   │
   │  PWA     │◄───────►│        │               │     Redis     │   │
   │  (React) │  WSS    │  ┌─────▼───────────────┴───────────────┐ │
   └──────────┘         │  │        Node.js Server (apps/server)  │ │
                        │  │  REST API · WS Gateway · Motor       │ │
                        │  │  Auth · Matchmaking · Salas          │ │
                        │  └──────────────────┬───────────────────┘ │
                        │                     │                     │
                        │        @flota/domain (puro)              │
                        └─────────────────────────────────────────────┘
```

---

## 2. Estructura del monorepo

```
flota-tactica-v2/
├── apps/
│   ├── server/               # API REST + WebSocket + motor autoritativo
│   │   ├── src/
│   │   │   ├── http/         # Rutas REST (auth, perfil)
│   │   │   ├── ws/           # Gateway WebSocket y handlers
│   │   │   ├── game/         # Gestión de sesiones y salas
│   │   │   ├── matchmaking/  # Cola pública
│   │   │   ├── auth/         # JWT, OAuth, hashing
│   │   │   ├── db/           # Esquema Drizzle y repositorios
│   │   │   └── infra/        # Redis, logger, config
│   │   └── package.json
│   └── web/                  # PWA React + Vite
│       ├── src/
│       │   ├── screens/      # Lobby, colocación, batalla, reglas
│       │   ├── components/   # Tablero, command deck, etc.
│       │   ├── stores/       # Estado de cliente
│       │   ├── api/          # Clientes REST y WebSocket
│       │   └── domain/       # Uso de @flota/domain (preview/validación)
│       └── package.json
├── packages/
│   ├── domain/               # Reglas puras del juego (sin I/O)
│   ├── protocol/             # Esquemas Zod y tipos de mensajes
│   └── config/               # tsconfig, lint, formato compartidos
├── docker/
│   ├── server.Dockerfile
│   └── compose.yml
├── docs/
├── .github/workflows/
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Componentes

### 3.1 `@flota/domain` — Motor de reglas puro

- **Responsabilidad:** modelar el juego (tablero, flota, acciones, habilidades) y aplicar las reglas de forma determinista.
- **Características:** sin red, sin base de datos, sin React; funciones puras y estado serializable.
- **Contenido:** `Rules`, `Catalog`, `Ship`, `Fleet`, `Board`, validación de acciones, resolución de ataques/sonar/reparación, detección de victoria.
- **Usado por:** servidor (autoridad), cliente (preview + validación optimista), tests.
- **Origen:** portado y tipado desde el prototipo `lib/game/tactical.mjs`.

### 3.2 `@flota/protocol` — Contratos

- **Responsabilidad:** definir los mensajes REST y WebSocket y validarlos con **Zod**.
- **Características:** tipos inferidos de los esquemas; una sola fuente de verdad para cliente y servidor.
- **Contenido:** esquemas de peticiones/respuestas REST, mensajes WS de cliente y servidor, catálogo de errores tipados, versión de protocolo.

### 3.3 `apps/server` — Servidor autoritativo

| Módulo | Responsabilidad |
|---|---|
| `http/` | Registro, login, refresh, perfil, OAuth callback, health |
| `auth/` | Hash Argon2, emisión/rotación de JWT y refresh tokens |
| `ws/` | Conexión, autenticación por token, enrutado de mensajes, heartbeat |
| `game/` | Ciclo de vida de partidas: crear, unirse, estado, acciones, revancha |
| `matchmaking/` | Cola pública en Redis y emparejamiento por criterios |
| `db/` | Esquema Drizzle, migraciones y repositorios |
| `infra/` | Cliente Redis, logger estructurado, configuración y secretos |

### 3.4 `apps/web` — PWA React

| Módulo | Responsabilidad |
|---|---|
| `screens/` | Lobby, selección de flota, colocación, emparejamiento, batalla, reglas |
| `components/` | Tablero 10×10, command deck, cortina de privacidad, toasts |
| `stores/` | Estado de cliente (sesión, partida, UI) |
| `api/` | Cliente REST y cliente WebSocket con reconexión |
| `domain/` | Invocaciones a `@flota/domain` para preview y pre-validación |
| `pwa/` | Manifiesto, service worker, caché de contenido estático |

---

## 4. Frontera de autoridad

Principio rector: **el servidor decide, el cliente sugiere**.

| Aspecto | Cliente | Servidor |
|---|---|---|
| Renderizar tablero y efectos | ✅ | — |
| Preview de arma/sonar (celdas afectadas) | ✅ (`@flota/domain`) | — |
| Pre-validar acciones propias (presupuesto, cooldown, cargas, rango, trayectoria) | ✅ (`@flota/domain`) | ✅ (autoridad) |
| Validar turno, secuencia y epoch | ❌ | ✅ |
| Resolver impactos y hundimientos | ❌ | ✅ |
| Resolver contactos de sonar | ❌ | ✅ |
| Filtrar información por jugador | ❌ | ✅ |
| Persistir estado y resultados | ❌ | ✅ |

**Nota sobre movimiento.** Las colisiones son solo contra la flota propia (ADR-014). Como el cliente conoce por completo su propia flota, su pre-validación de movimiento es exacta y coincide con la del servidor. Los chequeos que dependen de información oculta (impactos, sonar) solo los resuelve el servidor.

**Gestión de rechazos.** Si el servidor rechaza una acción pre-validada localmente (por estado desactualizado), responde con un error tipado; el cliente lo muestra y revierte cualquier efecto optimista.

---

## 5. Flujo de una acción

```
 Cliente                    Servidor                        Redis / PG
    │                          │                                │
    │ 1. game.action (WS)      │                                │
    ├─────────────────────────►│                                │
    │                          │ 2. validar protocolo (Zod)     │
    │                          │ 3. cargar partida ─────────────►│ (Redis)
    │                          │ 4. validar con @flota/domain   │
    │                          │ 5. aplicar estado              │
    │                          │ 6. persistir partida ──────────►│ (Redis)
    │                          │                                │
    │ 7. game.actionResult     │◄── vista filtrada al actor      │
    │◄─────────────────────────┤                                │
    │ 8. game.state (rival)    │◄── vista filtrada al rival      │
    │◄─────────────────────────┤                                │
    │                          │                                │
    │ 9. si termina: game.finished ────────────────────────────►│ (PG: historial)
```

Reglas del flujo:
- El cliente **nunca** envía resultados, solo intenciones (`move`, `attack`, `ability`, `end`, `ready`, `rematch`).
- El servidor **nunca** confía en datos derivados enviados por el cliente.
- Cada jugador recibe una **vista distinta**; el servidor filtra posiciones, PV y objetivos privados del rival.

---

## 6. Comunicación

### REST (HTTPS)

Para operaciones no frecuentes y sin estado de partida:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `GET /auth/oauth/:provider`, `GET /auth/oauth/:provider/callback`
- `GET /me`, `DELETE /me` (RGPD)
- `GET /health`

### WebSocket (WSS)

Para el flujo de partida y presencia:

- Autenticación: token en el handshake.
- Heartbeat (`ping`/`pong`) para detectar conexiones muertas.
- Reconexión con reanudación de partida en curso.
- Detalle de mensajes en `05-protocolo.md`.

---

## 7. Estado y persistencia

| Tipo de dato | Almacén | Motivo |
|---|---|---|
| Usuarios, cuentas OAuth, refresh tokens | PostgreSQL | Duradero y relacional |
| Historial de partidas y eventos | PostgreSQL | Consultas y auditoría |
| Sesiones activas | Redis | Rápido y con expiración |
| Cola de matchmaking | Redis | Operaciones atómicas de cola |
| Estado de partida en vivo | Redis (TTL) | Acceso de alta frecuencia; efímero |
| Pub/Sub para múltiples instancias WS | Redis | Escalado horizontal (fase futura) |

Esquema detallado en `04-modelo-datos.md`.

---

## 8. Seguridad

- **Autenticación:** Argon2 para contraseñas; access token JWT corto + refresh token rotativo en base de datos.
- **Autorización:** toda acción de partida se comprueba contra el jugador autenticado y su rol (host/guest).
- **Validación:** Zod en cada mensaje; rechazo de entradas malformadas o sobredimensionadas.
- **Rate limiting:** en endpoints de auth y creación de salas; límites por IP y por usuario.
- **Anti-trampas:** el servidor es la única autoridad; el cliente no puede alterar resultados.
- **Transporte:** TLS obligatorio (WSS/HTTPS).
- **Secretos:** fuera del repositorio, inyectados por entorno.
- **RGPD:** consentimiento, exportación y borrado de cuenta; minimización de datos.

---

## 9. Observabilidad

- **Logs estructurados** (JSON) con identificadores de correlación (usuario, partida, conexión).
- **Métricas:** conexiones WS activas, partidas en curso, latencia de acciones, errores.
- **Salud:** endpoint `/health` que verifica PostgreSQL y Redis.
- **Errores:** captura centralizada con contexto (sin datos sensibles).
- **Alertas:** umbrales de error y de latencia.

---

## 10. Escalabilidad

**Fase inicial:** una sola instancia de servidor en el VPS; suficiente para el MVP.

**Crecimiento:** el estado de partida vive en Redis, por lo que el servidor puede escalar horizontalmente. Para múltiples instancias se añade el adaptador **Redis Pub/Sub** para difundir mensajes entre nodos y *sticky sessions* o enrutado por sala en el balanceador.

**No objetivos del MVP:** múltiples regiones, sharding de partidas, escalado automático.

---

## 11. Despliegue

- **Docker Compose:** servicios `server`, `postgres`, `redis`, `proxy`.
- **Reverse proxy** con TLS automático (Caddy) y enrutado de `/` (PWA), `/api` (REST) y `/ws` (WebSocket).
- **Volúmenes persistentes** para PostgreSQL y backups periódicos.
- **CI/CD:** GitHub Actions construye y publica imágenes, y despliega por SSH (ver `02-sdlc.md`).
- **Entornos:** local, staging y producción con configuración equivalente.

---

## 12. Decisiones pendientes

| Tema | Estado |
|---|---|
| Biblioteca de WebSocket (`ws` vs `socket.io`) | Por decidir en Fase 2 |
| Framework HTTP (`Fastify` vs `Express`) | Por decidir en Fase 2 |
| Empaquetado nativo futuro (Capacitor) | Fuera del MVP |
| Proveedor de OAuth definitivo | Google + Apple propuestos |
