# 17 — Telemetría de retención

Objetivo: **saber cuándo merece la pena monetizar**. Antes de vender cosméticos o suscripciones necesitamos datos que demuestren que la gente **vuelve a jugar**. Este documento define qué métricas mirar, qué eventos registrar y cómo hacerlo de forma respetuosa con la privacidad.

> Documento de diseño. La implementación se puede hacer por fases (ver §8) y registrar como ADR.

---

## 1. Principios

- **Privacidad primero:** eventos **first-party** (nuestro servidor), sin trackers de terceros, sin datos personales innecesarios.
- **Minimización:** no registrar contenido sensible (mensajes, correos, tokens). Los eventos llevan un `userId` o un id anónimo, nunca PII en las propiedades.
- **Agregación:** las métricas se calculan en el servidor/base de datos; el cliente no decide nada.
- **Consentimiento:** avisar en la política de privacidad y permitir **desactivar** la telemetría (opt-out). Ver §9.
- **Bajo coste:** empezar con una tabla propia; migrar a una herramienta dedicada solo si hace falta.

---

## 2. Métrica principal (North Star)

Para un 1v1 por turnos, la señal de que hay producto es **que los jugadores completen partidas y vuelvan**. Propuesta de North Star:

> **Jugadores que completan ≥ 2 partidas en sus primeros 7 días.**

Es un proxy directo de valor percibido y de retención temprana, y es más informativo que "registros" o "partidas iniciadas".

---

## 3. Métricas clave

### Adquisición y activación
| Métrica | Definición |
|---|---|
| Registros | Cuentas nuevas (`auth_register`) |
| Activación | % de registrados que **completan** una partida en su primer día |
| Tiempo a la primera partida | Mediana entre `auth_register` y `match_end` (primera) |

### Retención
| Métrica | Definición |
|---|---|
| **D1 / D7 / D30** | % de una cohorte que vuelve a abrir la app esos días |
| **Stickiness (DAU/MAU)** | Usuarios activos diarios ÷ mensuales |
| Retención de jugadores | D7 de quienes completaron ≥ 1 partida (suele ser mucho mayor que la global) |

### Engagement
| Métrica | Definición |
|---|---|
| Partidas por jugador y semana | Frecuencia de uso |
| Duración de partida | Turnos y minutos (mediana) |
| Tasa de finalización | Partidas terminadas ÷ partidas iniciadas |
| Revancha | % de partidas terminadas seguidas de revancha |
| Sesiones por usuario | Veces que abre la app |

### Salud del sistema
| Métrica | Definición |
|---|---|
| Tasa de emparejamiento | % de intentos que acaban en partida |
| Tiempo de emparejamiento | Mediana hasta `match_found` |
| Desconexiones / abandono | Por partida |
| Errores de cliente | Por sesión |

---

## 4. Eventos a registrar

Nombres en `snake_case`. Las **propiedades** van en un `jsonb`, sin PII.

| Evento | Cuándo | Propiedades |
|---|---|---|
| `app_open` | Se abre la app/PWA | `standalone` (bool) |
| `auth_register` | Alta de cuenta | `provider` (`password`/`google`/`apple`) |
| `auth_login` | Inicio de sesión | `provider` |
| `lobby_view` | Se muestra el lobby | — |
| `room_create` | Crear sala privada | — |
| `room_join` | Unirse por código | `ok` (bool) |
| `matchmaking_enqueue` | Entrar en la cola | — |
| `match_found` | Emparejamiento | `waitMs` |
| `fleet_ready` | Flota preparada | — |
| `match_start` | Ambos listos | `mode` (`private`/`matchmaking`), `role` |
| `match_end` | Partida terminada | `mode`, `result` (`win`/`loss`), `turns`, `durationMs` |
| `match_abandon` | Abandono/desconexión | `reason` |
| `rematch_requested` | Pedir revancha | — |
| `error` | Error de cliente/servidor | `code` |
| `telemetry_optout` | El usuario desactiva telemetría | — |

**No registrar** (por volumen y privacidad): cada acción de juego (`move`/`attack`). Si se quiere, agregar contadores por partida en `match_end` (p. ej. `actions`, `shipsSunk`).

---

## 5. Arquitectura técnica

### Fase MVP (recomendada): tabla propia
- Nueva tabla `analytics_events` (PostgreSQL):
  ```sql
  analytics_events (
    id            bigserial primary key,
    user_id       uuid null references users(id) on delete set null,
    anonymous_id  text null,          -- usuarios no logueados (aleatorio, rotable)
    session_id    text not null,
    name          text not null,
    properties    jsonb not null default '{}',
    app_version   text,
    platform      text,               -- pwa | web | ios | android
    created_at    timestamptz not null default now()
  )
  ```
  Índices: `(name, created_at)`, `(user_id, created_at)`, `(session_id)`.
- Endpoint `POST /api/events` que acepta un **lote** de eventos (máx. p. ej. 50), validado con Zod, con rate limit.
- Cliente: una pequeña cola que **agrupa** eventos y los envía (al cerrar la app o cada N segundos) con `sendBeacon` cuando sea posible.
- El `user_id` se toma del token si hay sesión; si no, `anonymous_id` (UUID en `localStorage`, rotable).
- **Retención:** purgar eventos con más de 12 meses (o anonimizar).

### Alternativa gestionada (si crece)
- **PostHog** (autoalojado o cloud) para embudos, cohortes y *feature flags*.
- **Plausible/Umami** para analítica web agregada y sin cookies.
- Migrar solo cuando la tabla propia se quede corta.

---

## 6. Consultas de ejemplo

**Actividad diaria / stickiness**
```sql
select date_trunc('day', created_at) as dia,
       count(distinct coalesce(user_id::text, anonymous_id)) as activos
from analytics_events
where name = 'app_open' and created_at >= now() - interval '30 days'
group by 1 order by 1;
```

**Retención D1 por cohorte (registros por día)**
```sql
with cohort as (
  select user_id, date_trunc('day', created_at) as dia
  from analytics_events where name = 'auth_register'
)
select c.dia,
       count(distinct c.user_id) as registrados,
       count(distinct a.user_id) filter (
         where date_trunc('day', a.created_at) = c.dia + interval '1 day'
       ) as volvieron_d1
from cohort c
left join analytics_events a
  on a.user_id = c.user_id and a.name = 'app_open'
group by 1 order by 1;
```

**Embudo de activación**
```sql
select
  count(distinct user_id) filter (where name = 'auth_register') as registrados,
  count(distinct user_id) filter (where name = 'match_start')   as jugaron,
  count(distinct user_id) filter (where name = 'match_end')     as terminaron
from analytics_events;
```

**Tasa de finalización y duración**
```sql
select
  count(*) filter (where name = 'match_end')     as terminadas,
  count(*) filter (where name = 'match_start')   as iniciadas,
  percentile_cont(0.5) within group (order by (properties->>'durationMs')::int)
    filter (where name = 'match_end') as duracion_mediana_ms
from analytics_events;
```

---

## 7. Umbrales de "listo para monetizar"

Referencias orientativas del sector para juegos móviles/web (a adaptar a nuestro caso):

| Señal | Umbral razonable |
|---|---|
| **D1** | ≥ 25–30 % |
| **D7** | ≥ 10–15 % |
| **Stickiness (DAU/MAU)** | ≥ 15–20 % |
| **Tasa de finalización de partidas** | ≥ 80 % |
| **Jugadores con ≥ 2 partidas (semana 1)** | tendencia creciente |
| **Revancha** | ≥ 20 % de partidas terminadas |

Si D7 y la tasa de finalización son bajos, **primero se arregla el juego** (diversión, matchmaking, tiempos), no se monetiza.

---

## 8. Plan de implementación

| Fase | Entregable |
|---|---|
| **1. Base** | Tabla `analytics_events`, endpoint `POST /api/events` con Zod y rate limit, y cola de envío en el cliente |
| **2. Eventos clave** | `app_open`, `auth_register`, `lobby_view`, `match_start`, `match_end`, `match_abandon` |
| **3. Panel** | Consultas SQL (o vista) para DAU/WAU/MAU, D1/D7 y embudo |
| **4. Opt-out** | Preferencia de telemetría en la cuenta y aviso en privacidad |
| **5. Evaluación** | Revisar umbrales (§7) y decidir el paso a monetización |

---

## 9. Privacidad y RGPD

- **Base legal:** interés legítimo o consentimiento para analítica; documentarlo.
- **Datos:** ids seudónimos; sin PII en propiedades; sin venta a terceros.
- **Derechos:** el borrado de cuenta (`DELETE /me`) debe anonimizar/eliminar sus eventos (`on delete set null` + purga por antigüedad).
- **Cookies/almacenamiento:** el `anonymous_id` en `localStorage` puede requerir aviso; una analítica **sin cookies** (o con opt-out claro) simplifica el cumplimiento.
- **Retención:** definir plazo (p. ej. 12 meses) y purga automática.
- **Menores:** si hay público joven, extremar minimización.

---

## 10. Resumen

- **North Star:** jugadores que completan ≥ 2 partidas en sus primeros 7 días.
- **Métricas:** D1/D7/D30, stickiness, tasa de finalización, revancha, emparejamiento.
- **Eventos:** un puñado de eventos de embudo (no cada acción de juego).
- **Implementación:** tabla propia + endpoint por lotes + consultas SQL; migrar a PostHog/Plausible si crece.
- **Regla:** **no monetizar hasta superar los umbrales de retención.**
