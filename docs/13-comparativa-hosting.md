# 13 — Comparativa de hosting: VPS vs Cloudflare vs Firebase/Supabase

Comparativa orientada a **este proyecto**: servidor **Node/Fastify autoritativo**, **WebSocket persistente**, **PostgreSQL** y **Redis**, para partidas 1v1 por turnos.

La pregunta clave no es "cuál es mejor", sino **cuánto código hay que reescribir** y **cuánta operación asumes**.

---

## 1. Veredicto rápido

| | **VPS** | **Cloudflare Workers + DO** | **Firebase** | **Supabase** |
|---|---|---|---|---|
| Encaja con el código actual | ✅ Sin cambios | ❌ Reescribir servidor | ❌ Reescribir backend | ⚠️ Como BD/Auth, o reescribir |
| WebSocket persistente | ✅ | ✅ (Durable Objects) | ⚠️ No nativo | ✅ Realtime |
| PostgreSQL | ✅ (en la VM) | ❌ (D1 = SQLite) | ❌ (Firestore) | ✅ (gestionado) |
| Redis | ✅ | ❌ | ❌ | ⚠️ (no Redis; usa Realtime) |
| Auth incluida | ❌ (la nuestra) | ❌ | ✅ | ✅ |
| Operación | Alta (tú gestionas) | Mínima | Mínima | Baja |
| Coste beta | 5–12 €/mes (o 0 en Oracle/Pi) | 0 (con límites) | 0 con avisos | 0 con avisos |
| Lock-in | Bajo | Alto | Alto | Medio |
| Latencia | Según región | Global (edge) | Global | Según región |
| Esfuerzo de migración | Ninguno | Alto | Alto | Medio/alto |

---

## 2. VPS (Hetzner, Dinahosting, OVH, Lightsail, EC2)

**Qué es:** una máquina virtual con root donde corre nuestro `docker compose` tal cual.

- **A favor:** cero cambios de código; WebSocket nativo; PostgreSQL y Redis en la misma máquina; control total; sin lock-in; TLS automático con Caddy; el CD ya está montado.
- **En contra:** tú gestionas seguridad, backups, actualizaciones y disponibilidad; escalado manual; coste mensual (salvo Oracle Always Free o Raspberry Pi).
- **Ideal si:** quieres la beta en marcha **ya**, sin tocar el código, y no te importa un poco de operación.

---

## 3. Cloudflare Workers + Durable Objects

**Qué es:** cómputo en el edge sin servidor. Los **Durable Objects** son el mecanismo ideal para **WebSocket** con estado por partida.

- **A favor:** cero operación, escala global, excelente para WebSocket; capa gratuita que puede cubrir una beta; sin base de datos externa (DO + D1/KV/R2).
- **En contra:** **hay que reescribir el servidor** para el runtime de Workers (no es Node; Fastify no aplica). Argon2 nativo no corre (habría que usar WASM o PBKDF2/WebCrypto); no hay Redis (se sustituye por almacenamiento de DO/KV); el modelo de partida cambia a "un Durable Object por partida".
- **Coste/límites:** Workers tiene capa gratuita (peticiones/día); los mensajes de WebSocket cuentan como tráfico; en picos puede requerir plan de pago.
- **Ideal si:** aceptas invertir en una reescritura a cambio de **cero operación y alcance global**.

> El paquete `@flota/domain` (reglas puras) y `@flota/protocol` (Zod) **sí se reutilizan**; lo que se reescribe es la capa de servidor/transporte.

---

## 4. Firebase (Google)

**Qué es:** Firestore/Realtime Database + Auth + Hosting + Cloud Functions.

- **A favor:** **Auth** excelente (email/OAuth) y hosting estático sencillo; sincronización en tiempo real con Firestore.
- **En contra:** no es un servidor WebSocket general; el modelo autoritativo habría que rehacerlo con **Cloud Functions** (que además **requieren el plan Blaze de pago** para funciones, desde 2024) o con reglas de seguridad. Firestore no es PostgreSQL; se pierde Drizzle. Las **escuchas en tiempo real consumen lecturas** (coste por operación).
- **Ideal si:** ya estás en el ecosistema Google y aceptas rediseñar el backend alrededor de Firestore. **Mal encaje** para nuestro modelo autoritativo.

---

## 5. Supabase (PostgreSQL gestionado)

**Qué es:** Postgres gestionado + Auth + Realtime + Edge Functions (Deno) + Storage.

- **A favor:** es **PostgreSQL** (nuestro esquema Drizzle es portable); **Auth** lista; **Realtime** por WebSocket; capa gratuita generosa para una beta.
- **En contra:** dos formas de usarlo:
  1. **Como componentes** (lo más sensato): usar Supabase solo como **Postgres** y/o **Auth**, y seguir con nuestro servidor Node (en VPS/Pi/túnel) y Upstash para Redis. Cambio mínimo (cadena de conexión).
  2. **Como backend completo**: mover la lógica autoritativa a **Edge Functions** + Realtime. Las Edge Functions son petición/respuesta (sin conexión persistente), así que el bucle de partida habría que reestructurarlo. Cambio medio/alto.
- **Avisos:** los proyectos gratuitos **se pausan tras ~1 semana de inactividad**; límites de conexiones Realtime y almacenamiento.
- **Ideal si:** quieres **Postgres y Auth gestionados** sin renunciar a nuestro servidor Node.

---

## 6. Patrón híbrido recomendado

Lo más pragmático suele ser **combinar**:

- **Cómputo:** VPS / Raspberry Pi / túnel local (nuestro servidor Node, sin reescribir).
- **PostgreSQL gestionado:** Supabase o Neon (gratis) si no quieres mantener la BD en la máquina.
- **Redis gestionado:** Upstash (gratis) si no quieres mantener Redis.

Así el código apenas cambia (variables `DATABASE_URL`/`REDIS_URL`) y reduces la operación.

```
Cliente (PWA)
   │ HTTPS/WSS
   ▼
Servidor Node (VPS/Pi/túnel) ──► PostgreSQL gestionado (Supabase/Neon)
   │                          └─► Redis gestionado (Upstash)
```

---

## 7. Guía de decisión

| Si tu prioridad es… | Elige |
|---|---|
| Poner la beta en marcha ya, sin tocar código | **VPS** (o Raspberry Pi / túnel) |
| Cero operación y alcance global, con reescritura | **Cloudflare Workers + DO** |
| Mantener Node pero delegar BD y Auth | **Supabase** (como Postgres/Auth) + VPS |
| Menor coste absoluto | **Oracle Always Free / Raspberry Pi / túnel** |
| Todo el ecosistema Google | **Firebase** (a coste de rediseño) |

---

## 8. Conclusión para Flota Táctica

- **Ahora (beta):** VPS barato, Raspberry Pi o túnel local. **Cero cambios de código** y WebSocket estable.
- **Si buscas cero operación a largo plazo:** Cloudflare Workers + Durable Objects es técnicamente el mejor encaje para WebSocket, pero exige reescribir el servidor. Se puede planificar como fase posterior reutilizando `@flota/domain` y `@flota/protocol`.
- **Si quieres gestionados sin reescribir:** Supabase (Postgres/Auth) + un host Node pequeño + Upstash. Cambio mínimo.
- **Firebase:** solo si se adopta su modelo (Firestore + Functions de pago); no encaja bien con nuestro servidor autoritativo actual.
