# 04 — Modelo de Datos

Esquema de persistencia de Flota Táctica v2: **PostgreSQL** para datos duraderos (gestionado con **Drizzle**) y **Redis** para estado efímero de alta frecuencia.

---

## 1. Principios

- **PostgreSQL** guarda identidad, cuentas vinculadas y el historial de partidas.
- **Redis** guarda sesiones activas, cola de matchmaking, estado de partidas en vivo y canales de pub/sub.
- Los datos privados de un jugador (posiciones, PV, camuflaje, objetivo de reparación) **nunca** se persisten de forma que el rival pueda leerlos.
- El historial en PostgreSQL es una **instantánea final** de la partida, no el estado en vivo.

---

## 2. Esquema PostgreSQL (Drizzle)

### 2.1 `users`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` | Identificador |
| `email` | `text` | UNIQUE, NOT NULL | Correo |
| `password_hash` | `text` | NULL | Hash Argon2 (nulo si solo OAuth) |
| `display_name` | `text` | NOT NULL | Nombre visible |
| `email_verified` | `boolean` | NOT NULL, default `false` | Verificación de correo |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Alta |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Última modificación |
| `deleted_at` | `timestamptz` | NULL | Baja lógica (RGPD) |

Índices: `UNIQUE (lower(email))`, `(deleted_at)`.

### 2.2 `oauth_accounts`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador |
| `user_id` | `uuid` | FK → `users.id`, ON DELETE CASCADE | Usuario |
| `provider` | `text` | NOT NULL | `google` \| `apple` |
| `provider_user_id` | `text` | NOT NULL | ID en el proveedor |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Alta |

Índices: `UNIQUE (provider, provider_user_id)`, `(user_id)`.

### 2.3 `refresh_tokens`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador |
| `user_id` | `uuid` | FK → `users.id`, ON DELETE CASCADE | Usuario |
| `token_hash` | `text` | NOT NULL, UNIQUE | Hash del refresh token |
| `expires_at` | `timestamptz` | NOT NULL | Caducidad |
| `revoked_at` | `timestamptz` | NULL | Revocación |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Emisión |
| `user_agent` | `text` | NULL | Contexto (opcional) |

Índices: `UNIQUE (token_hash)`, `(user_id)`, `(expires_at)`.

### 2.4 `games`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador de partida |
| `status` | `text` | NOT NULL | `active` \| `finished` \| `abandoned` |
| `mode` | `text` | NOT NULL | `private` \| `matchmaking` |
| `winner_user_id` | `uuid` | FK → `users.id`, NULL | Ganador |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creación |
| `finished_at` | `timestamptz` | NULL | Fin |
| `final_epoch` | `integer` | NOT NULL, default `0` | Epoch final (revanchas) |

Índices: `(status)`, `(created_at)`, `(winner_user_id)`.

### 2.5 `game_players`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK | Identificador |
| `game_id` | `uuid` | FK → `games.id`, ON DELETE CASCADE | Partida |
| `user_id` | `uuid` | FK → `users.id` | Jugador |
| `role` | `text` | NOT NULL | `host` \| `guest` |
| `result` | `text` | NULL | `win` \| `loss` |
| `fleet_snapshot` | `jsonb` | NULL | Flota final (tipos y PV) |

Índices: `UNIQUE (game_id, role)`, `(user_id)`.

### 2.6 `game_events`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `bigserial` | PK | Secuencia |
| `game_id` | `uuid` | FK → `games.id`, ON DELETE CASCADE | Partida |
| `epoch` | `integer` | NOT NULL | Ronda (revancha) |
| `seq` | `integer` | NOT NULL | Secuencia de acción |
| `turn` | `integer` | NOT NULL | Turno |
| `actor_user_id` | `uuid` | FK → `users.id`, NULL | Autor |
| `type` | `text` | NOT NULL | `ready` \| `move` \| `attack` \| `ability` \| `end` \| `rematch` |
| `payload` | `jsonb` | NOT NULL | Datos públicos del evento |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Momento |

Índices: `(game_id, epoch, seq)`, `(game_id, created_at)`.

> `payload` contiene **solo información pública**. Las posiciones y PV privados se resuelven en el estado de Redis y no se registran aquí.

### 2.7 Relaciones

```
users 1───* oauth_accounts
users 1───* refresh_tokens
users 1───* game_players
games 1───* game_players
games 1───* game_events
```

---

## 3. Esquema de estado de partida (Redis)

El estado en vivo se serializa en Redis con TTL. Es la fuente de verdad durante la partida.

### 3.1 Claves

| Clave | Tipo | TTL | Contenido |
|---|---|---|---|
| `game:{gameId}` | hash/JSON | 24 h | Estado autoritativo completo |
| `game:{gameId}:conn` | set | — | Conexiones WS de la partida |
| `session:{userId}` | string | 7 d | Sesión activa (refresh vigente) |
| `ws:user:{userId}` | string | 5 min | Nodo/instancia de la conexión WS |
| `matchmaking:queue` | sorted set | — | Cola pública (score = timestamp) |
| `matchmaking:ticket:{userId}` | string | 5 min | Ticket de búsqueda |
| `ratelimit:{scope}:{key}` | string | variable | Contadores de límite de peticiones |
| `pubsub:game:{gameId}` | canal | — | Difusión entre instancias (fase futura) |

### 3.2 Estructura del estado autoritativo

```jsonc
{
  "id": "uuid",
  "epoch": 0,
  "status": "active",
  "turn": 4,
  "ap": 2,
  "seq": 7,
  "players": {
    "host":  { "userId": "uuid", "ready": false, "rematch": false },
    "guest": { "userId": "uuid", "ready": false, "rematch": false }
  },
  "fleets": {
    "host":  [ { "id": "sub", "at": 34, "vertical": true, "hp": 4, "cloakUntil": -1,
                 "ledger": { "move": -1, "attack": -1, "ability": -1,
                             "nextAbility": 0, "charges": 3 } } ],
    "guest": [ /* ... */ ]
  },
  "history": {
    "host": { "shots": [], "incoming": [], "contacts": [], "enemySunk": [] },
    "guest": { "shots": [], "incoming": [], "contacts": [], "enemySunk": [] }
  },
  "winner": null,
  "createdAt": 1757500000000
}
```

> `fleets` y `history` contienen datos privados. El servidor **filtra** este objeto antes de enviarlo a cada jugador (ver `05-protocolo.md`).

---

## 4. Filtrado de vistas

El servidor transforma el estado autoritativo en una **vista por jugador**:

| Campo | Propio | Rival |
|---|---|---|
| Tipos de barco | ✅ | ✅ (públicos desde `ready`) |
| Posiciones | ✅ | ❌ |
| PV y camuflaje | ✅ | ❌ |
| Objetivo de reparación | ✅ | ❌ |
| Celdas reveladas por sonar | ✅ (solo del turno) | ❌ |
| Historial de impactos propios | ✅ | ❌ |
| Historial de disparos recibidos | ✅ | ❌ |
| Barcos hundidos del rival | ✅ | ✅ |

---

## 5. Migraciones

- Gestionadas por **Drizzle Kit** (`drizzle-kit generate` / `drizzle-kit migrate`).
- Las migraciones se versionan en el repositorio (`apps/server/drizzle/`).
- En CI se ejecutan contra un PostgreSQL efímero (Testcontainers) para validar que aplican limpiamente.
- En producción, la migración se aplica antes de desplegar la nueva versión del servidor.

---

## 6. Retención y RGPD

| Dato | Retención | Base |
|---|---|---|
| Cuenta y perfil | Mientras la cuenta esté activa | Consentimiento |
| Refresh tokens | Hasta su caducidad o revocación | Necesidad operativa |
| Historial de partidas | 12 meses (configurable) | Interés legítimo |
| Estado de partida en vivo (Redis) | TTL 24 h | Necesidad operativa |
| Logs con datos personales | Mínimos y anonimizados | Seguridad |

**Borrado de cuenta:** `DELETE /me` realiza baja lógica (`deleted_at`), revoca refresh tokens, anonimiza el historial y programa el borrado físico. Se documenta en la política de privacidad.

---

## 7. Copias de seguridad

- PostgreSQL: copia diaria y retención de 30 días; prueba de restauración periódica.
- Redis: persistencia AOF; se asume que el estado en vivo puede perderse (las partidas activas son efímeras y reconstruibles solo dentro de su TTL).
