# 06 — Roadmap y Plan de Fases

Plan de ejecución por fases para Flota Táctica v2. Cada fase es un incremento verificable con un **criterio de salida** claro. La metodología está en `02-sdlc.md`.

> Las estimaciones son orientativas y relativas; no representan compromisos de fecha.

---

## Resumen

| Fase | Nombre | Objetivo | Criterio de salida |
|---|---|---|---|
| 0 | Fundaciones | Base técnica del monorepo | CI en verde con lint, tipos, tests y build |
| 1 | Dominio y protocolo | Portar el motor de reglas a TypeScript | 100% de los tests de dominio portados y superados |
| 2 | Servidor autoritativo | Auth, WS, salas y partida | Partida completa por WS entre dos clientes de prueba |
| 3 | Cliente PWA | Interfaz completa contra el servidor | Flujo completo desde la PWA |
| 4 | Matchmaking y ciclo | Cola pública, reconexión, revancha | Partida + reconexión + revancha probadas |
| 5 | Endurecimiento y despliegue | Seguridad, carga, observabilidad | Staging validado y producción operativa |
| 6 | Lanzamiento | Beta y ajustes | MVP estable en producción |

---

## Fase 0 — Fundaciones

**Objetivo:** establecer la base técnica del monorepo.

**Tareas:**
- Inicializar `pnpm-workspace.yaml` con `apps/*` y `packages/*`.
- `packages/config`: tsconfig base estricto, configuración de `oxlint` y `oxfmt`.
- Esqueletos de `@flota/domain`, `@flota/protocol`, `apps/server`, `apps/web`.
- `docker/compose.yml` con PostgreSQL y Redis para desarrollo local.
- GitHub Actions: lint, typecheck, test, build.
- README e índice de documentación.

**Criterio de salida:** CI en verde; `pnpm install`, `pnpm build` y `pnpm test` funcionan en local.

---

## Fase 1 — Dominio y protocolo

**Objetivo:** portar las reglas del juego a un paquete TypeScript puro y definir el contrato.

**Tareas:**
- Portar `tactical.mjs` a `@flota/domain` con tipos estrictos:
  - Tablero 10×10, catálogo de 6 barcos, presupuesto y validación de flota.
  - Colocación, movimiento (trayectoria completa, solo colisión propia).
  - Cañón, torpedo (recorte de bordes), sonar (3×3), camuflaje, autorreparación, reparación aliada.
  - Daño por barco, hundimiento, victoria, revancha y `epoch`.
- Portar los tests unitarios del prototipo (`tactical.test.mjs`) a Vitest.
- Definir `@flota/protocol` con esquemas Zod (REST y WS).
- Documentar la frontera de autoridad y las reglas de privacidad.

**Criterio de salida:** todos los casos del prototipo cubiertos por tests en verde; cobertura ≥ 80% en `@flota/domain`.

---

## Fase 2 — Servidor autoritativo

**Objetivo:** servidor que gestiona usuarios, sesiones, salas y partidas completas.

**Tareas:**
- Esquema Drizzle y migraciones (usuarios, OAuth, refresh tokens, partidas, eventos).
- Auth: registro, login, refresh, logout, hash Argon2, JWT.
- Gateway WebSocket: autenticación, heartbeat, enrutado, validación Zod.
- Gestión de salas privadas: crear, unir, estado.
- Motor autoritativo: aplicar acciones, filtrar vistas, persistir en Redis.
- Ciclo de partida completo por WS (sin interfaz gráfica todavía).
- Pruebas de integración con Testcontainers (PostgreSQL + Redis reales).

**Criterio de salida:** dos clientes de prueba (script/CLI) completan una partida de principio a fin por WebSocket; el servidor valida y filtra correctamente.

---

## Fase 3 — Cliente PWA

**Objetivo:** interfaz completa contra el servidor.

**Tareas:**
- Setup React + Vite + Tailwind; PWA (manifiesto, service worker, caché de contenido estático).
- Pantallas: registro/login, lobby, selección de flota, colocación, emparejamiento, batalla, reglas.
- Tablero 10×10 con todos los estados visuales del prototipo.
- Command deck: selección de barco, ataque, habilidades, maniobra, fin de turno.
- Integración con `@flota/domain` para preview y validación optimista.
- Cliente WebSocket con reconexión y gestión de errores tipados.
- Responsive (móvil primero) y cortina de privacidad en modo simulación (si se conserva).

**Criterio de salida:** un usuario completa el flujo registro → sala → partida → resultado desde la PWA.

---

## Fase 4 — Matchmaking y ciclo completo

**Objetivo:** emparejamiento público y continuidad de la partida.

**Tareas:**
- Cola de matchmaking en Redis y emparejamiento por criterios.
- Reconexión y reanudación de partida (`game.resume`).
- Revancha bilateral con incremento de `epoch`.
- Gestión de abandono y expiración de partidas.
- Pruebas E2E (Playwright) de los flujos críticos.

**Criterio de salida:** partida por matchmaking público, reconexión a mitad de partida y revancha, todo verificado por E2E.

---

## Fase 5 — Endurecimiento y despliegue

**Objetivo:** preparar el sistema para producción.

**Tareas:**
- Rate limiting, validación estricta, cabeceras de seguridad, TLS.
- Observabilidad: logs estructurados, métricas, `/health`, alertas.
- Backups de PostgreSQL y prueba de restauración.
- Dockerfiles de producción y `compose` con reverse proxy.
- Pipeline CD a staging y producción.
- Pruebas de carga (k6) y ajustes de rendimiento.
- Cumplimiento RGPD: borrado de cuenta, política de privacidad.

**Criterio de salida:** staging validado con datos sintéticos; producción operativa con monitorización y backups.

---

## Fase 6 — Lanzamiento

**Objetivo:** beta cerrada y estabilización del MVP.

**Tareas:**
- Beta cerrada con jugadores reales.
- Corrección de errores y ajustes de equilibrio (`RULES`/`CATALOG`).
- Revisión de rendimiento y coste.
- Preparación de la siguiente iteración (estadísticas, historial, más modos).

**Criterio de salida:** MVP estable en producción, con partidas completas sin incidencias críticas.

---

## Backlog posterior (fuera del MVP)

- Historial de partidas y estadísticas por usuario.
- Perfil público y sistema de amigos.
- Chat o emotes entre jugadores.
- Emparejamiento por nivel/ELO.
- Nuevos barcos, habilidades o mapas.
- Empaquetado nativo (Capacitor) para tiendas.
- Espectadores y torneos.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Complejidad del servidor autoritativo | Alto | Fase 1 (dominio) sólida antes de Fase 2; pruebas de integración tempranas |
| Divergencia cliente/servidor | Medio | Paquete de dominio único y compartido (ADR-008) |
| Operación del VPS (seguridad, backups) | Medio | Automatización, monitorización y pruebas de restauración |
| Escalado del WebSocket | Bajo (MVP) | Estado en Redis + pub/sub preparado para el futuro |
| Cumplimiento RGPD | Medio | Minimización de datos y borrado desde el diseño |
| Latencia y abandono de partidas | Medio | Reconexión y TTLs claros; pruebas de carga |

---

## Hitos de decisión

- **Tras Fase 1:** validar el portado fiel de las reglas antes de invertir en servidor.
- **Tras Fase 2:** validar el protocolo con clientes de prueba antes de construir la UI.
- **Tras Fase 4:** decisión de *go/no-go* para producción.
- **Tras Fase 5:** autorización de lanzamiento de la beta.
