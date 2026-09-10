# 05 — Protocolo de Comunicación

Contrato de comunicación entre cliente y servidor: **REST** para autenticación y perfil, **WebSocket** para el flujo de partida. Todos los mensajes se definen y validan con **Zod** en `@flota/protocol`.

---

## 1. Convenciones

- **Formato:** JSON sobre HTTPS (REST) y WSS (WebSocket).
- **Versión de protocolo:** campo `v` en cada mensaje WS. La versión actual es `1`.
- **Identificadores:** UUID v4 para partidas, usuarios y salas.
- **Códigos de error:** catálogo tipado y estable (sección 5).
- **Tamaño máximo de mensaje:** 16 KB; los mayores se rechazan.
- **Idioma:** los mensajes de error de UI se devuelven como códigos; el cliente los traduce al español.

---

## 2. API REST

Base: `/api`. Respuestas JSON. Errores con `{ "error": { "code": "...", "message": "..." } }`.

### 2.1 Autenticación

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `POST` | `/auth/register` | `{ email, password, displayName }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ user, accessToken, refreshToken }` |
| `POST` | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST` | `/auth/logout` | `{ refreshToken }` | `204` |
| `GET` | `/auth/oauth/:provider` | — | Redirección al proveedor |
| `GET` | `/auth/oauth/:provider/callback` | `?code=...` | `{ user, accessToken, refreshToken }` |

`provider` ∈ `google`, `apple`.

### 2.2 Perfil

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/me` | `{ id, email, displayName, createdAt }` |
| `PATCH` | `/me` | `{ displayName? }` |
| `DELETE` | `/me` | `204` (baja y anonimización RGPD) |

### 2.3 Utilidad

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/health` | `{ status, postgres, redis, version }` |

### 2.4 Ejemplo de esquema Zod (registro)

```ts
export const RegisterRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(32),
});

export const AuthResponse = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string(),
    createdAt: z.string().datetime(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
});
```

---

## 3. WebSocket

### 3.1 Conexión

- URL: `wss://<host>/ws`
- Autenticación: el cliente envía `auth` como primer mensaje, o el access token en el handshake (`Authorization: Bearer`).
- Heartbeat: el servidor envía `ping` periódicamente; el cliente responde `pong`. Sin respuesta en 30 s, la conexión se cierra.
- Reconexión: el cliente reautentica y solicita `game.resume`.

### 3.2 Sobre de mensaje

Todo mensaje lleva un sobre común:

```ts
export const Envelope = z.object({
  v: z.literal(1),
  id: z.string().uuid(),          // id del mensaje (para trazas)
  type: z.string(),               // tipo concreto
  ts: z.number().int(),           // timestamp ms
});
```

Los mensajes de partida añaden `gameId`, `epoch` y `seq` donde corresponda.

---

### 3.3 Cliente → Servidor

| Tipo | Cuerpo | Descripción |
|---|---|---|
| `auth` | `{ accessToken }` | Autenticación si no se usó handshake |
| `pong` | `{}` | Respuesta a heartbeat |
| `room.create` | `{ mode: 'private' }` | Crea sala privada y devuelve código |
| `room.join` | `{ code }` | Se une a una sala por código |
| `room.leave` | `{ gameId }` | Abandona la sala |
| `matchmaking.enqueue` | `{}` | Entra en la cola pública |
| `matchmaking.cancel` | `{}` | Sale de la cola |
| `game.ready` | `{ gameId, ships: [shipType, shipType, shipType] }` | Flota elegida (solo tipos) |
| `game.action` | `{ gameId, epoch, seq, cmd }` | Acción de partida |
| `game.rematch` | `{ gameId, epoch }` | Solicita revancha |
| `game.resume` | `{ gameId }` | Reanuda una partida en curso |

**Comandos (`cmd`) admitidos:**

```ts
export const MoveCommand    = z.object({ kind: z.literal('move'),    ship: ShipId, dx: z.number().int(), dy: z.number().int(), distance: z.number().int().min(1) });
export const AttackCommand  = z.object({ kind: z.literal('attack'),  ship: ShipId, target: Cell, axis: z.enum(['row','column']) });
export const AbilityCommand = z.object({ kind: z.literal('ability'), ship: ShipId, target: Cell.optional(), ally: ShipId.optional() });
export const EndCommand     = z.object({ kind: z.literal('end') });

export const Command = z.discriminatedUnion('kind', [
  MoveCommand, AttackCommand, AbilityCommand, EndCommand,
]);
```

> **Cambio respecto al prototipo:** con servidor autoritativo, `move` incluye `dx/dy/distance` y `ability` incluye `ally`. El cliente ya no calcula el estado localmente como fuente de verdad; el servidor recibe la intención completa y la valida. El servidor nunca reenvía estos datos privados al rival.

---

### 3.4 Servidor → Cliente

| Tipo | Cuerpo | Descripción |
|---|---|---|
| `auth.ok` | `{ userId }` | Autenticación correcta |
| `ping` | `{}` | Heartbeat |
| `room.created` | `{ gameId, code }` | Sala creada (código compartible) |
| `room.state` | `{ gameId, players, status }` | Estado de la sala |
| `matchmaking.matched` | `{ gameId }` | Rival encontrado |
| `game.state` | `{ gameId, epoch, view }` | Vista filtrada del juego |
| `game.actionResult` | `{ seq, result }` | Resultado de la acción al actor |
| `game.turnChanged` | `{ turn, ap, activeRole }` | Cambio de turno |
| `game.finished` | `{ winnerRole, winnerId }` | Partida terminada |
| `game.rematchState` | `{ host, guest }` | Estado de solicitudes de revancha |
| `game.resumed` | `{ gameId, epoch, view }` | Partida reanudada |
| `error` | `{ code, message, ref? }` | Error tipado |

**Vista filtrada (`view`)** — cada jugador recibe solo lo que puede ver (ver `04-modelo-datos.md`, §4):

```ts
export const PlayerView = z.object({
  gameId: z.string().uuid(),
  epoch: z.number().int(),
  status: z.enum(['placement', 'waiting', 'turn', 'opponent', 'finished']),
  turn: z.number().int(),
  ap: z.number().int(),
  role: z.enum(['host', 'guest']),
  myFleet: z.array(OwnShip),                 // posiciones, hp, cloak, ledger
  enemyShips: z.array(EnemyShip),            // tipo y hundido, sin posición
  myShots: z.array(Cell),                    // historial de disparos
  myIncoming: z.array(Cell),                 // impactos recibidos
  contacts: z.array(Cell),                   // sonar del turno actual
  enemySunk: z.array(ShipId),
  rematch: z.object({ host: z.boolean(), guest: z.boolean() }),
  winner: z.enum(['me', 'peer']).nullable(),
});
```

---

## 4. Secuencia de una partida

```
Cliente A                Servidor                 Cliente B
   │                        │                        │
   │ room.create            │                        │
   ├───────────────────────►│                        │
   │◄─ room.created {code}  │                        │
   │                        │◄──── room.join {code} ─┤
   │◄─ room.state ──────────┼──── room.state ───────►│
   │                        │                        │
   │ game.ready {ships}     │                        │
   ├───────────────────────►│◄──── game.ready ───────┤
   │◄─ game.state ──────────┼──── game.state ───────►│
   │                        │                        │
   │ game.action {cmd}      │                        │
   ├───────────────────────►│  (valida con domain)   │
   │◄─ game.actionResult ───┼──── game.state ───────►│
   │◄─ game.turnChanged ────┼──── game.turnChanged ─►│
   │                        │                        │
   │            ... turnos alternos ...              │
   │                        │                        │
   │◄─ game.finished ───────┼──── game.finished ────►│
   │ game.rematch           │                        │
   ├───────────────────────►│◄──── game.rematch ─────┤
   │◄─ game.state (nueva) ──┼──── game.state ───────►│
```

---

## 5. Catálogo de errores

| Código | Significado | HTTP/WS |
|---|---|---|
| `AUTH_REQUIRED` | Falta autenticación | 401 |
| `AUTH_INVALID` | Credenciales inválidas | 401 |
| `TOKEN_EXPIRED` | Token caducado | 401 |
| `EMAIL_TAKEN` | Correo ya registrado | 409 |
| `RATE_LIMITED` | Demasiadas peticiones | 429 |
| `ROOM_NOT_FOUND` | Código de sala inexistente | 404 |
| `ROOM_FULL` | Sala completa | 409 |
| `NOT_YOUR_TURN` | Acción fuera de turno | WS |
| `INVALID_ACTION` | Acción no permitida por las reglas | WS |
| `STALE_EPOCH` | Epoch desactualizado | WS |
| `SEQ_MISMATCH` | Secuencia incorrecta | WS |
| `MESSAGE_TOO_LARGE` | Mensaje sobredimensionado | WS |
| `GAME_FINISHED` | Partida ya terminada | WS |
| `INTERNAL` | Error interno | 500 |

El cliente mapea cada código a un texto en español para la UI.

---

## 6. Reconexión

1. El cliente detecta la caída (heartbeat o cierre) y muestra el estado "Reconectando…".
2. Reabre el WebSocket y reautentica.
3. Envía `game.resume { gameId }`.
4. El servidor responde `game.resumed` con la vista filtrada actual.
5. Si la partida ya terminó o expiró (TTL de Redis), el servidor informa y el cliente vuelve al lobby.

---

## 7. Compatibilidad y evolución

- El campo `v` permite evolucionar el protocolo; cambios incompatibles incrementan `v`.
- Los mensajes desconocidos se ignoran o se rechazan con `error` según severidad.
- Los esquemas Zod son la fuente de verdad; los tipos TypeScript se infieren de ellos.
- Cualquier cambio de contrato actualiza este documento y la suite de pruebas de integración.
