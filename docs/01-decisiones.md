# 01 — Registro de Decisiones de Arquitectura (ADR)

Este documento recoge las decisiones de arquitectura y proceso tomadas para Flota Táctica v2. Cada decisión sigue el formato **ADR** (contexto → decisión → consecuencias) y es estable salvo que se revise explícitamente.

| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | Arquitectura cliente-servidor autoritativa | Aceptada |
| ADR-002 | Monorepo con pnpm workspaces | Aceptada |
| ADR-003 | TypeScript en todo el stack | Aceptada |
| ADR-004 | PWA React como cliente instalable | Aceptada |
| ADR-005 | PostgreSQL + Redis como persistencia | Aceptada |
| ADR-006 | Drizzle como ORM | Aceptada |
| ADR-007 | WebSocket como canal de tiempo real | Aceptada |
| ADR-008 | Paquete de dominio puro compartido con validación optimista | Aceptada |
| ADR-009 | Registro de usuarios (email/contraseña + OAuth) | Aceptada |
| ADR-010 | Salas privadas + matchmaking público | Aceptada |
| ADR-011 | Despliegue en VPS con Docker | Aceptada |
| ADR-012 | Metodología Kanban con sprints cortos | Aceptada |
| ADR-013 | Idioma: código en inglés, UI y documentación en español | Aceptada |
| ADR-014 | Información asimétrica y colisión solo contra flota propia | Aceptada |
| ADR-015 | Validación de protocolo con Zod | Aceptada |
| ADR-016 | Fastify como framework HTTP | Aceptada |
| ADR-017 | `ws` como biblioteca WebSocket | Aceptada |
| ADR-018 | `jose` (JWT) y `@node-rs/argon2` (hash) | Aceptada |
| ADR-019 | `ioredis` como cliente Redis | Aceptada |
| ADR-020 | Mutex en proceso por partida (limitación conocida) | Aceptada |
| ADR-021 | Testcontainers para pruebas de integración | Aceptada |
| ADR-022 | Rate limiting y cabeceras de seguridad (helmet) | Aceptada |
| ADR-023 | Observabilidad con Prometheus (`/metrics`) | Aceptada |
| ADR-024 | Despliegue con Docker Compose y Caddy (TLS) | Aceptada |
| ADR-025 | CD a GHCR y despliegue por SSH | Aceptada |
| ADR-026 | Beta con coste 0 en Oracle Cloud Always Free | Aceptada |
| ADR-027 | Beta sin cuentas: local + túnel gratuito | Aceptada |

---

## ADR-001 — Arquitectura cliente-servidor autoritativa

**Contexto.** El prototipo 0.1 usaba conexión directa P2P (WebRTC sin servidor) con un modelo de "cliente honesto": cada cliente poseía su propia flota y podía mentir sobre movimientos o impactos. Además, una desconexión perdía la partida y no había recuperación de estado.

**Decisión.** Adoptar un **servidor central autoritativo**. El servidor posee el estado completo de la partida, valida todas las acciones y envía a cada jugador únicamente la vista que le corresponde. El cliente envía intenciones, nunca resultados.

**Consecuencias.**
- Positivas: anti-trampas real, estado consistente, reconexión sin pérdida, base para matchmaking y estadísticas futuras.
- Negativas: se introduce infraestructura (servidor, base de datos, despliegue) y una dependencia de red; mayor coste operativo.

---

## ADR-002 — Monorepo con pnpm workspaces

**Contexto.** Servidor, cliente y lógica de dominio deben compartir tipos y reglas sin duplicación.

**Decisión.** Un único repositorio con **pnpm workspaces**, organizado en `apps/*` y `packages/*`.

**Consecuencias.**
- Positivas: contratos y reglas compartidos con un solo cambio atómico; CI unificada; refactors coordinados.
- Negativas: configuración de build más compleja; acoplamiento de versiones entre paquetes.

---

## ADR-003 — TypeScript en todo el stack

**Contexto.** El prototipo era JavaScript (`.mjs`). El dominio es rico en estructuras de datos y reglas que se benefician de tipado.

**Decisión.** **TypeScript estricto** (`strict: true`) en todos los paquetes: dominio, protocolo, servidor y cliente.

**Consecuencias.**
- Positivas: errores detectados en compilación, tipado compartido cliente/servidor, mejor refactorización y autocompletado.
- Negativas: paso de compilación adicional y disciplina de tipos.

---

## ADR-004 — PWA React como cliente instalable

**Contexto.** Se necesita un cliente instalable para iPhone y Android sin pasar por tiendas de aplicaciones, y ya existe experiencia con React y con una PWA.

**Decisión.** Cliente **React 19 + Vite** distribuido como **PWA** (service worker, manifiesto, instalable). Empaquetado como app nativa posible en una fase futura, no en el MVP.

**Consecuencias.**
- Positivas: multiplataforma, sin tiendas, reutiliza conocimiento del prototipo, caché offline para reglas y catálogo.
- Negativas: capacidades nativas limitadas; el modo offline solo cubre contenido estático (las partidas requieren conexión).

---

## ADR-005 — PostgreSQL + Redis como persistencia

**Contexto.** Se necesitan datos relacionales duraderos (usuarios, historial) y estado efímero de alta frecuencia (sesiones, matchmaking, partidas en vivo).

**Decisión.** **PostgreSQL** para datos persistentes y **Redis** para sesiones, cola de matchmaking, estado de partidas activas y pub/sub.

**Consecuencias.**
- Positivas: cada motor se usa para lo que es idóneo; Redis habilita tiempo real y escalado horizontal del WebSocket.
- Negativas: dos sistemas que operar y respaldar.

---

## ADR-006 — Drizzle como ORM

**Contexto.** Se necesita acceso tipado a PostgreSQL sin la sobrecarga de un ORM pesado.

**Decisión.** **Drizzle ORM** para el esquema y las consultas, con migraciones versionadas.

**Consecuencias.**
- Positivas: SQL cercano, tipado fuerte derivado del esquema, bajo peso en runtime, migraciones explícitas.
- Negativas: ecosistema más joven que alternativas como Prisma; algunas abstracciones hay que escribirlas a mano.

---

## ADR-007 — WebSocket como canal de tiempo real

**Contexto.** El juego es por turnos y requiere intercambio bidireccional de baja latencia.

**Decisión.** **WebSocket** para el flujo de partida; **REST** para autenticación, perfil y operaciones no frecuentes.

**Consecuencias.**
- Positivas: comunicación bidireccional y eficiente, notificaciones de servidor, control de reconexión.
- Negativas: hay que gestionar heartbeats, reconexión y (a futuro) pub/sub entre instancias.

---

## ADR-008 — Paquete de dominio puro compartido con validación optimista

**Contexto.** Las reglas del juego deben ejecutarse de forma autoritativa en el servidor, pero el cliente se beneficia de feedback inmediato. El prototipo ya separaba el motor (`tactical.mjs`) de la interfaz.

**Decisión.** Extraer un paquete **`@flota/domain`** puro (sin I/O ni red), compartido por servidor, cliente y tests. El cliente lo usa para **preview visual y validación optimista**; el servidor lo usa como **autoridad final**. El cliente nunca decide resultados dependientes de información oculta (impactos, contactos de sonar).

**Consecuencias.**
- Positivas: cero duplicación de reglas (mismo código en ambos lados), mejor UX, dominio testeable de forma aislada.
- Negativas: la vista del cliente puede quedar desactualizada respecto al servidor; un rechazo puntual debe gestionarse con un error de UI y rollback visual.

---

## ADR-009 — Registro de usuarios (email/contraseña + OAuth)

**Contexto.** El MVP requiere cuentas para matchmaking, historial de partidas y reconexión identificable.

**Decisión.** Registro con **email y contraseña** (hash con Argon2) más **OAuth social** (Google y Apple como mínimo). Sesión mediante **access token JWT** de vida corta + **refresh token** rotativo almacenado en base de datos.

**Consecuencias.**
- Positivas: control propio de identidad y compatibilidad con proveedores externos; base para estadísticas futuras.
- Negativas: obligaciones de RGPD (consentimiento, borrado de cuenta, protección de datos); más superficie de seguridad.

---

## ADR-010 — Salas privadas + matchmaking público

**Contexto.** Dos jugadores conocidos deben poder jugar rápido, y también debe existir la opción de encontrar rival.

**Decisión.** Dos vías: **salas privadas con código corto** y **cola de matchmaking público** gestionada en Redis.

**Consecuencias.**
- Positivas: cubre ambos casos de uso sin fricción.
- Negativas: el matchmaking público requiere emparejamiento por criterios y, a futuro, moderación y gestión de abandonos.

---

## ADR-011 — Despliegue en VPS con Docker

**Contexto.** Se busca control, coste predecible y soporte fiable de WebSocket persistente.

**Decisión.** **VPS con Docker Compose**: `server`, `postgres`, `redis` y un reverse proxy (`Caddy` o `nginx`) con TLS. Despliegue automatizado por SSH desde CI.

**Consecuencias.**
- Positivas: control total, sin límites de plataformas serverless, WebSocket sin complicaciones.
- Negativas: responsabilidad de operación, backups, actualizaciones de seguridad y monitorización.

---

## ADR-012 — Metodología Kanban con sprints cortos

**Contexto.** Proyecto con un equipo reducido y un MVP acotado.

**Decisión.** **Kanban** con **sprints de 1–2 semanas**. Cada fase produce un incremento verificable. Detalle en `02-sdlc.md`.

**Consecuencias.**
- Positivas: adaptabilidad, foco en flujo continuo, poca sobrecarga de proceso.
- Negativas: requiere disciplina para limitar el trabajo en curso (WIP) y mantener el tablero actualizado.

---

## ADR-013 — Idioma: código en inglés, UI y documentación en español

**Contexto.** El prototipo usa identificadores y comentarios en inglés, y textos de interfaz y documentación en español.

**Decisión.** Mantener ese criterio: **código (identificadores y comentarios) en inglés**, **textos de interfaz y documentación en español**.

**Consecuencias.**
- Positivas: consistencia con el prototipo, código idiomático y documentación accesible al equipo.
- Negativas: convivencia de dos idiomas que exige criterio claro en los límites (p. ej. mensajes de error de UI en español, logs en inglés).

---

## ADR-014 — Información asimétrica y colisión solo contra flota propia

**Contexto.** En el prototipo, cada jugador solo conoce su flota y los resultados limitados de sus acciones. El rival es invisible y ocupa una capa lógica separada.

**Decisión.** Mantener el modelo de **información asimétrica**: el servidor nunca revela al rival posiciones, PV ni objetivo de reparación. Las **colisiones de movimiento son solo contra la propia flota**; los barcos enemigos no bloquean el movimiento (hacerlo filtraría sus posiciones). El sonar revela celdas como parte explícita del juego.

**Consecuencias.**
- Positivas: preserva la tensión táctica y evita fugas de información; la validación de movimiento del cliente es exacta (solo depende de datos propios).
- Negativas: hay que documentar con claridad la frontera entre lo público y lo privado y verificarla con tests.

---

## ADR-015 — Validación de protocolo con Zod

**Contexto.** Todos los mensajes de cliente y servidor deben validarse de forma estricta para evitar estados inválidos y entradas maliciosas.

**Decisión.** Definir los contratos de mensajes en **`@flota/protocol`** con esquemas **Zod**, compartidos por ambos lados y usados en el servidor como puerta de validación.

**Consecuencias.**
- Positivas: una sola fuente de verdad para los contratos, tipado inferido, validación en runtime.
- Negativas: dependencia adicional y coste de mantenimiento de los esquemas.

---

## ADR-016 — Fastify como framework HTTP

**Contexto.** El servidor necesita HTTP (REST) y WebSocket con buen rendimiento y tipado.

**Decisión.** Usar **Fastify** con `@fastify/cors` y `@fastify/websocket`.

**Consecuencias.**
- Positivas: alto rendimiento, excelente soporte de TypeScript, ecosistema de plugins y `app.inject()` para pruebas.
- Negativas: menor familiaridad que Express para algunos equipos.

---

## ADR-017 — `ws` como biblioteca WebSocket

**Contexto.** El canal de partida es WebSocket puro; no se necesitan salas ni reconexión automática de alto nivel.

**Decisión.** Usar **`ws`** a través de `@fastify/websocket`, sin `socket.io`.

**Consecuencias.**
- Positivas: ligero, estándar, control total del protocolo; el contrato ya está definido con Zod.
- Negativas: hay que implementar heartbeat, reconexión y enrutado a mano (ya previsto).

---

## ADR-018 — `jose` para JWT y `@node-rs/argon2` para contraseñas

**Contexto.** Se necesitan tokens de acceso firmados y hash de contraseñas seguro.

**Decisión.** **`jose`** para firmar/verificar JWT (HS256) y **`@node-rs/argon2`** para el hash de contraseñas. Refresh tokens aleatorios almacenados con hash SHA-256.

**Consecuencias.**
- Positivas: `jose` es moderno y sin dependencias nativas; `@node-rs/argon2` trae binarios precompilados (sin `node-gyp`).
- Negativas: dependencia de binarios por plataforma en `@node-rs/argon2`.

---

## ADR-019 — `ioredis` como cliente Redis

**Contexto.** El estado de partida, la cola de matchmaking y las sesiones viven en Redis.

**Decisión.** Usar **`ioredis`**.

**Consecuencias.**
- Positivas: API madura, soporte de scripts Lua (`EVAL`) para operaciones atómicas y reconexión.
- Negativas: una dependencia adicional frente al cliente oficial.

---

## ADR-020 — Mutex en proceso por partida (limitación conocida)

**Contexto.** Las secuencias leer-modificar-guardar sobre Redis (por ejemplo, ambos jugadores bloqueando su flota a la vez) pueden perder actualizaciones.

**Decisión.** Serializar las mutaciones por partida con un **mutex en proceso** indexado por `gameId`. El matchmaking usa un script Lua atómico.

**Consecuencias.**
- Positivas: elimina las carreras en un despliegue de una sola instancia (el del MVP) sin infraestructura extra.
- Negativas: **no es válido para múltiples instancias**; al escalar horizontalmente habrá que sustituirlo por un bloqueo distribuido o por operaciones atómicas en Redis.

---

## ADR-021 — Testcontainers para pruebas de integración

**Contexto.** Las pruebas deben ejecutarse contra PostgreSQL y Redis reales, sin depender de servicios locales.

**Decisión.** Usar **Testcontainers** para levantar contenedores efímeros en las pruebas de integración.

**Consecuencias.**
- Positivas: pruebas autocontenidas y fieles a producción; requiere Docker (disponible en CI).
- Negativas: arranque más lento (decenas de segundos) y dependencia de Docker.

---

## ADR-022 — Rate limiting y cabeceras de seguridad

**Contexto.** Los endpoints de autenticación son el principal vector de abuso; conviene frenar la fuerza bruta y añadir cabeceras de seguridad.

**Decisión.** Usar **`@fastify/rate-limit`** con un límite global y otro más estricto en registro/login/refresh, y **`@fastify/helmet`** para cabeceras de seguridad. El tamaño del cuerpo se limita con `bodyLimit`.

**Consecuencias.**
- Positivas: mitiga fuerza bruta y abuso; cabeceras estándar; límites configurables por entorno.
- Negativas: en despliegues con varias instancias, el almacén del rate limit debe ser compartido (Redis) para ser coherente.

---

## ADR-023 — Observabilidad con Prometheus

**Contexto.** Se necesita medir el uso y detectar problemas en producción.

**Decisión.** Exponer métricas en **`/metrics`** con **`prom-client`** (métricas por defecto del proceso + contadores de peticiones HTTP, conexiones WebSocket y partidas iniciadas). Los logs estructurados de pino redactan datos sensibles.

**Consecuencias.**
- Positivas: métricas estándar listas para Prometheus/Grafana; logs sin secretos.
- Negativas: `/metrics` debe protegerse en producción (restringido por el proxy).

---

## ADR-024 — Despliegue con Docker Compose y Caddy

**Contexto.** Se quiere un despliegue reproducible en VPS con TLS y soporte de WebSocket.

**Decisión.** Imágenes Docker multi-etapa para servidor y web; **Docker Compose** de producción con PostgreSQL, Redis, servidor, web (nginx) y **Caddy** como reverse proxy con TLS automático. Las migraciones se ejecutan con un contenedor de un solo uso antes de levantar la nueva versión.

**Consecuencias.**
- Positivas: TLS automático, enrutado de `/api` y `/ws`, actualización atómica con migración previa.
- Negativas: responsabilidad de operar el VPS (backups, seguridad, actualizaciones).

---

## ADR-025 — CD a GHCR y despliegue por SSH

**Contexto.** Hay que automatizar la publicación y el despliegue tras integrar en `main`.

**Decisión.** GitHub Actions construye y publica las imágenes en **GHCR** y, después, despliega por **SSH** en el VPS: `pull`, migración y `up -d`.

**Consecuencias.**
- Positivas: despliegue reproducible y trazable (imágenes etiquetadas por commit).
- Negativas: requiere secretos de VPS en GitHub y acceso del VPS a GHCR.

---

## ADR-026 — Beta con coste 0 en Oracle Cloud Always Free

**Contexto.** La fase de beta debe tener **coste 0**; más adelante se valorarán opciones de pago o alternativas gratuitas para producción. El juego necesita conexiones WebSocket persistentes, lo que descarta hosts gratuitos que duermen el servicio.

**Decisión.** Desplegar la beta en una **VM ARM de Oracle Cloud Always Free** con el mismo `docker compose` de producción (PostgreSQL, Redis, servidor, web y Caddy) y un **subdominio gratuito** (`sslip.io` o DuckDNS) con TLS automático. Las imágenes se construyen **multi-arquitectura** y la VM puede compilar en local sin registro.

**Consecuencias.**
- Positivas: coste 0 real y sin caducidad, WebSocket estable, sin cambios de código, TLS gratuito; migración futura a un VPS de pago sin tocar el código.
- Negativas: aprovisionar la VM ARM puede ser complicado; sin alta disponibilidad; la operación (backups, seguridad) sigue siendo responsabilidad propia.

---

## ADR-027 — Beta sin cuentas: local + túnel gratuito

**Contexto.** No siempre es posible crear una VM en Oracle ni cuentas en servicios gestionados (Neon, etc.). Se necesita una vía de beta con **coste 0 y sin registros**.

**Decisión.** Ejecutar el stack completo en el equipo del desarrollador con **Docker Compose** (PostgreSQL, Redis, servidor y web) y publicarlo con un **túnel gratuito** (Cloudflare quick tunnel o localhost.run). El contenedor **web (nginx) actúa como entrada única** y hace de proxy de `/api`, `/ws` y `/health` hacia el servidor, de modo que el túnel solo necesita un puerto.

**Consecuencias.**
- Positivas: cero cuentas y cero coste; mismo stack que producción; WebSocket estable; HTTPS para instalar la PWA.
- Negativas: solo disponible mientras el equipo esté encendido; la URL del quick tunnel cambia en cada reinicio (se puede fijar con un túnel con nombre o DuckDNS).

---

## Plantilla para nuevas decisiones

```
## ADR-0XX — Título

**Contexto.** ...

**Decisión.** ...

**Consecuencias.**
- Positivas: ...
- Negativas: ...
```
