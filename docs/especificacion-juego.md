# Flota Táctica — Especificación del Juego

> Extracción completa de la dinámica, reglas, interfaz y protocolo del prototipo 0.1.
> Documento de referencia para la re-implementación con servidor central + frontend instalable.

---

## 1. Visión general

**Flota Táctica** es un juego de estrategia por turnos para **2 jugadores**. Cada jugador construye una flota de 3 barcos sobre un tablero 10×10 y se enfrenta al rival mediante ataques, maniobras y habilidades especiales. Gana quien hunda los 3 barcos del oponente.

- **Género:** Estrategia táctica naval por turnos
- **Jugadores:** 2 (uno host, otro guest)
- **Duración estimada:** 10–20 minutos por partida
- **Modelo de información:** Información asimétrica — cada jugador solo conoce su propia flota y los resultados limitados de sus acciones

---

## 2. Tablero

| Propiedad | Valor |
|---|---|
| Dimensiones | 10 × 10 (100 casillas) |
| Indexación | 0–99, fila por fila |
| Notación | Columnas `1–10`, Filas `A–J` |
| Coordenada ejemplo | Celda 54 → **F5** (fila F, columna 5) |

**Coordenada:** `fila = ⌊c / 10⌋` (0–9), `columna = c % 10` (0–9).
**Fórmula de posición:** `c = fila × 10 + columna`

---

## 3. Catálogo de barcos

### 3.1 Tabla completa

| ID | Marca | Nombre | Costo | Tamaño | PV | Velocidad | Poder | Arma | Habilidad | Enfriamiento | Cargas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `scout` | EX | Explorador | 2 | 2 | 3 | 3 | 1 | Cañón | Sonar | 2 | ∞ (99) |
| `sub` | SU | Submarino | 4 | 3 | 4 | 2 | 1 | Torpedo | Camuflaje | 3 | 3 |
| `frigate` | FR | Fragata | 4 | 3 | 6 | 2 | 2 | Cañón | Autorreparación | 3 | 2 |
| `support` | TA | Taller naval | 3 | 3 | 5 | 1 | 1 | Cañón | Reparación aliada | 2 | 2 |
| `destroyer` | DE | Destructor | 4 | 3 | 5 | 3 | 2 | Torpedo | — | 0 | 0 |
| `dread` | AC | Acorazado | 6 | 4 | 9 | 1 | 3 | Cañón | — | 0 | 0 |

### 3.2 Descripción por rol

- **Explorador (EX):** Barco rápido y frágil. Cañón de 1 daño + sonar infinito (revela zona 3×3). El ojo del equipo.
- **Submarino (SU):** Oculto al sonar mientras usa camuflaje. Torpedo de 3 celdas. Vulnerable si lo detectan.
- **Fragata (FR):** Equilibrada. Cañón de 2 daño + autorreparación (2 PV, 2 veces por partida). Resistente.
- **Taller naval (TA):** Lenta pero curandera. Repara 3 PV a aliados cercanos (alcance 2 casillas Manhattan). Esencial para sostenimiento.
- **Destructor (DE):** El más rápido. Torpedo de 3 celdas + velocidad 3. Sin habilidad especial — puro poder ofensivo.
- **Acorazado (AC):** Tanque. 9 PV + cañón de 3 daño. Caro (6 pts), lento (vel 1), pero devastador.

---

## 4. Presupuesto y selección de flota

| Regla | Valor |
|---|---|
| Barcos por flota | **3** (exactos) |
| Presupuesto máximo | **13 puntos** |
| Restricción | Barcos deben ser de **clases distintas** |
| Validación | Costo total ≤ 13, 3 IDs únicos del catálogo |

**Combinaciones válidas de ejemplo:**
- Explorador(2) + Submarino(4) + Soporte(3) = 9 ✓
- Explorador(2) + Fragata(4) + Destructor(4) = 10 ✓
- Submarino(4) + Fragata(4) + Destructor(4) = 12 ✓
- Explorador(2) + Soporte(3) + Acorazado(6) = 11 ✓
- Acorazado(6) + Destructor(4) + Submarino(4) = 14 ✗ (excede 13)

---

## 5. Colocación de barcos

### 5.1 Reglas de colocación

- Cada barco ocupa `tamaño` casillas contiguas en línea recta (horizontal o vertical).
- **Orientación fija:** una vez colocada, la orientación (horizontal/vertical) **nunca cambia** durante la partida.
- **Pueden tocarse** (adyacentes), pero **nunca solaparse** (misma celda ocupada por 2 barcos).
- Barcos dentro del tablero: todas las celdas deben estar en rango 0–99.
- Horizontal: no puede cruzar de una fila a otra (las celdas deben tener el mismo `⌊c/10⌋`).

### 5.2 Interacción de colocación

- Seleccionar tipo de barco → tocar celda de inicio → barco aparece en esa posición.
- Botón **"Girar"** cambia orientación horizontal ↔ vertical.
- Botón **"Al azar"** genera colocación aleatoria válida.
- **"Flota preparada"** valida y bloquea la flota (envía solo tipos al rival, posiciones privadas).

---

## 6. Estructura de turno

### 6.1 Flujo básico

```
┌─────────────────────────────────────────────┐
│  INICIO DE TURNO                            │
│  • Puntos de acción (AP): 2                 │
│  • Cada acción cuesta 1 AP                  │
│  • Cada barco puede hacer 1 movimiento,     │
│    1 ataque y 1 habilidad (máx c/u por turno)│
├─────────────────────────────────────────────┤
│  ACCIONES DISPONIBLES                       │
│  • Mover barco (1 AP)                       │
│  • Atacar (1 AP)                            │
│  • Usar habilidad (1 AP)                    │
│  • Terminar turno (gasta AP restante)        │
├─────────────────────────────────────────────┤
│  FIN DE TURNO                               │
│  • AP llega a 0 → turno pasa al rival       │
│  • Turno se incrementa                      │
└─────────────────────────────────────────────┘
```

### 6.2 Restricciones por turno

| Restricción | Detalle |
|---|---|
| AP por turno | 2 |
| Acciones por barco/tipo/turno | 1 movimiento, 1 ataque, 1 habilidad |
| Barcos hundidos | No pueden realizar ninguna acción |
| Orden | Cada acción debe completarse (recibir resultado) antes de la siguiente |
| Host vs Guest | Host juega en turnos pares (0, 2, 4...), Guest en impares (1, 3, 5...) |

### 6.3 Protocolo de dos fases

1. Jugador A ejecuta `act(cmd)` localmente
2. Comando público se envía al Jugador B
3. Jugador B recibe, valida y aplica efectos → envía `result`
4. Jugador A recibe resultado → aplica a tracking enemigo
5. Ambos incrementan `seq`. Si AP = 0, avanza turno

---

## 7. Acciones detalladas

### 7.1 Movimiento

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Dirección | Cardinal: Norte (0,-1), Sur (0,1), Oeste (-1,0), Este (1,0) |
| Distancia | 1 a `velocidad` casillas (entero) |
| Restricción | Movimiento en línea recta, sin giros |
| Colisión | Toda la trayectoria verificada: cada paso intermedio debe estar libre de barcos vivos |
| Barcos hundidos (PV=0) | **No bloquean** el movimiento |
| Átomo | Si cualquier paso falla, **todo el movimiento se rechaza** (sin movimiento parcial) |
| Privacidad | Dirección, distancia y destino **nunca se envían** al rival |

### 7.2 Cañón

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Alcance | Tablero completo (sin límite de distancia) |
| Objetivo | 1 celda exacta |
| Daño | Poder del barco atacante (1–3) |
| Efecto | Cada barco enemigo que ocupe la celda recibe **1 evento de daño** (PV -= poder) |
| Colateral | Si una celda tiene varios barcos, cada uno recibe 1 evento de daño |
| Hundimiento | Si PV llega a 0 → barco hundido, no puede ser dañado más |

### 7.3 Torpedo

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Alcance | Tablero completo |
| Objetivo | 3 celdas en línea recta (derecha o abajo) |
| Dirección | `fila`: derecha (target, target+1, target+2) / `columna`: abajo (target, target+10, target+20) |
| Límite | Recortado a bordes del tablero (no envuelve filas) |
| Daño | Cada barco enemigo que ocupe alguna celda recibe **1 evento de daño** (no 3) |
| Poder | Igual al poder del barco atacante |

**Ejemplo:** Torpedo del Submarino (poder 1) en celda 9, dirección fila → solo celda 9 (las celdas 10, 11 están en otra fila).

### 7.4 Sonar (Explorador)

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Zona | 3×3 centrada en la celda objetivo (hasta 9 celdas) |
| Recorte | Esquinas del tablero reducen la zona |
| Cargas | Ilimitadas (99) |
| Enfriamiento | 2 turnos propios |
| Resultado | Lista de celdas donde hay barcos enemigos **no camuflados** |
| Caducidad | Contactos válidos **solo el turno actual**; se borran al cambiar de turno |

**Ejemplo:** Sonar en celda 0 (esquina) → revela celdas 0, 1, 10, 11 (solo 4 de 9).

### 7.5 Camuflaje (Submarino)

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Cargas | 3 por partida |
| Enfriamiento | 3 turnos propios |
| Duración | 2 turnos propios (turno_actual + 4 incrementos) |
| Efecto | Barco invisible al sonar enemigo |
| **NO protege** | Los ataques siguen dañando normalmente |
| Ruptura | Atacar **rompe el camuflaje inmediatamente** (se pierde el resto de la duración) |

### 7.6 Autorreparación (Fragata)

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Cargas | 2 por partida |
| Enfriamiento | 3 turnos propios |
| Curación | +2 PV (tope: PV máximo de la clase) |
| Restricción | No se puede usar con PV al máximo |

### 7.7 Reparación aliada (Taller naval)

| Propiedad | Valor |
|---|---|
| Costo | 1 AP |
| Cargas | 2 por partida |
| Enfriamiento | 2 turnos propios |
| Curación | +3 PV al aliado (tope: PV máximo del aliado) |
| Alcance | Distancia Manhattan ≤ 2 entre **cualquier celda** del taller y **cualquier celda** del aliado |
| Restricción | Aliado debe estar **vivo** (PV > 0) y **dañado** (PV < máximo) |
| Privacidad | El objetivo de reparación **nunca se envía** al rival |
| No resucita | Barcos hundidos no pueden ser reparados |

---

## 8. Daño y hundimiento

### 8.1 Reglas de daño

- Cada ataque genera **exactamente 1 evento de daño por barco**, sin importar cuántas celdas del barco coincidan con el ataque.
- Daño = poder del arma del atacante.
- PV se reduce, mínimo 0.
- Un barco con PV=0 se considera **hundido**.

### 8.2 Consecuencias del hundimiento

| Consecuencia | Detalle |
|---|---|
| Acciones | Barco hundido no puede moverse, atacar ni usar habilidades |
| Colisión | No bloquea movimiento de otros barcos |
| Ataque | Atacar una celda con un barco hundido retorna 0 impactos |
| Visual | Se marca como "hundido" con tachado |

---

## 9. Condición de victoria

| Condición | Detalle |
|---|---|
| Victoria | Hundir los **3 barcos** del rival |
| Empate | Imposible (las acciones se resuelven secuencialmente) |
| Mensaje ganador | `'me'` (para el ganador), `'peer'` (para el perdedor) |
| Fase | `'finished'` — muestra resultado y opción de revancha |

---

## 10. Revancha

- Ambos jugadores deben solicitar revancha **independientemente**.
- Cuando ambos aceptan:
  1. `epoch` se incrementa (invalida paquetes en vuelo)
  2. El juego vuelve a fase de **colocación**
  3. Ambos construyen flota nueva
- Si solo uno solicita, la fase queda en `'finished'` esperando.

---

## 11. Fases del juego

| Fase | Condición | Descripción |
|---|---|---|
| `disconnected` | Sin conexión | Esperando conexión |
| `placement` | Flota no bloqueada | Construcción y colocación de barcos |
| `waiting` | Flota lista, rival no | Esperando que el rival termine su colocación |
| `turn` | Es mi turno | Fase activa: se pueden ejecutar acciones |
| `opponent` | Turno del rival | Esperando acción del oponente |
| `result` | Acción pendiente | Esperando confirmación del resultado |
| `finished` | Hay ganador | Partida terminada |

---

## 12. Modelo de información y privacidad

### 12.1 Datos privados (nunca se envían)

- Posiciones de barcos propios
- Dirección y distancia de movimientos
- PV restantes de barcos propios
- Objetivo de reparación aliada
- Estado de camuflaje

### 12.2 Datos públicos (se comparten)

- Tipos de barcos elegidos (solo en `ready`)
- Comando ejecutado (tipo, barco, objetivo de ataque/sonar)
- Resultado del ataque (impactos, hundimientos, contactos de sonar)
- Tipos de barcos enemigos (se muestran en UI)

### 12.3 Validación del protocolo

| Campo validado | Descripción |
|---|---|
| `v` | Versión del paquete (2) |
| `game` | ID de la sesión |
| `epoch` | Debe coincidir con epoch actual (invalida tras revancha) |
| `seq` | Secuencia incremental, debe coincidir |
| `turn` | Debe coincidir con el turno actual |
| Formato | `strict` en comandos y resultados |
| Cargas/Enfriamiento | Validados antes de ejecutar |
| Resultados | Impactos dentro de celdas objetivo, hundimientos únicos y válidos, contactos dentro de zona de sonar |
| Tamaño | Mensajes máximos 8192 bytes |

**Consecuencia de fraude:** Cualquier anomalía (resultado forjado, epoch obsoleto, paquete replay, tamaño excesivo) **desconecta la sesión**.

> **Nota:** Este es un modelo de "cliente honesto". Un cliente modificado podría mentir sobre movimientos o impactos privados. No se promete seguridad competitiva — el juego asume confianza mutua entre jugadores cercanos.

---

## 13. Interfaz de usuario — Pantallas y flujos

### 13.1 Mapa de pantallas

```
┌──────────────────────────────────────────────────────┐
│                     LOBBY                             │
│  "FLOTA TÁCTICA" · "Cómo jugar"                      │
│                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │
│  │Ver partida  │ │Probar con   │ │Conectar dos     │ │
│  │de ejemplo   │ │dos jugadores│ │dispositivos     │ │
│  │             │ │(simulación) │ │por Wi-Fi        │ │
│  └──────┬──────┘ └──────┬──────┘ └────────┬────────┘ │
│         │               │                 │           │
│         ▼               ▼                 ▼           │
│  ┌──────────────────────────────────────────────────┐ │
│  │          CATÁLOGO (solo lectura en lobby)         │ │
│  │  6 tarjetas de barco con stats                    │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              SELECCIÓN DE FLOTA                       │
│                                                      │
│  "Tu combinación · N/3 barcos · X/13 puntos"         │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Catálogo ahora SELECTABLE                        │ │
│  │ Click = agregar/quitar de tu flota                │ │
│  │ Máximo 3 barcos distintos, costo ≤ 13            │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              COLOCACIÓN DE FLOTA                      │
│                                                      │
│  ┌──────────────────┐  ┌───────────────────────────┐ │
│  │   TABLERO 10×10  │  │ Selector de barco         │ │
│  │   (colocación)   │  │ [Girar] [Al azar]         │ │
│  │                  │  │                           │ │
│  │  Click = colocar │  │ [Flota preparada]         │ │
│  │  barco seleccion │  │                           │ │
│  └──────────────────┘  └───────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│           EMPAREJAMIENTO Wi-Fi                        │
│                                                      │
│  1. Crear conexión (host) → genera código offer       │
│  2. Unirse y generar respuesta (guest)                │
│  3. Confirmar respuesta (host)                        │
│                                                      │
│  Intercambio manual de códigos JSON                   │
│  Timeout: 120 segundos                               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              PANTALLA DE BATALLA                      │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Sessionbar: sesión + controles                   │ │
│  ├─────────────────────────────────────────────────┤ │
│  │ Turn strip: TURNO N · Tu turno / Turno rival    │ │
│  │             · AP: N/2 acciones                   │ │
│  ├──────────────────────┬──────────────────────────┤ │
│  │   AGUAS RIVALES      │    TU FLOTA              │ │
│  │   (tablero enemigo)  │    (tablero propio)      │ │
│  │   10 × 10            │    10 × 10              │ │
│  ├──────────────────────┴──────────────────────────┤ │
│  │             COMMAND DECK                         │ │
│  │  [Selector barco] [Ataque] [Habilidad] [Mover]  │ │
│  ├─────────────────────────────────────────────────┤ │
│  │  BITÁCORA: últimos 20 eventos                    │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │ En victoria: resultado + "Nueva partida"         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│            MODAL: CÓMO JUGAR                          │
│                                                      │
│  Reglas completas en español                         │
│  Secciones: flota, turno, armas, habilidades,         │
│  camuflaje, reparación, victoria, honest-client       │
│                                                      │
│  [Entendido]                                         │
└──────────────────────────────────────────────────────┘
```

### 13.2 Elementos del tablero de batalla

| Elemento | Descripción |
|---|---|
| Celda vacía | Sin barco visible |
| Celda ocupada | Muestra marca del barco (`EX`, `SU`, `FR`, `TA`, `DE`, `AC`) en posición inicial, `━` en celdas restantes |
| Impacto (×) | Celda donde un ataque falló (agua) |
| Hundido | Barco con PV=0: tachado + "hundido" |
| Contacto sonar (◉) | Celda revelada por sonar |
| Marcador de apuntado | Borde naranja en celdas objetivo del arma seleccionada |
| Barco seleccionado | Resaltado especial en tablero propio |

### 13.3 Command Deck (panel de comandos)

| Sección | Contenido |
|---|---|
| Selector de barco | Barra horizontal: marca, nombre, PV, barra de progreso, estado (camuflado) |
| Ataque | Nombre del barco + arma ("Cañón · N daño" / "Torpedo ×3 · N daño") + botón "Apuntar" |
| Dirección torpedo | Select: "Hacia la derecha" (fila) / "Hacia abajo" (columna) |
| Habilidad | Botón según tipo: Sonar / Camuflaje / Autorreparar / Reparar aliado |
| Reparación aliado | Select con aliados elegibles + confirmar |
| Info de habilidad | Cargas restantes + enfriamiento |
| Barra de objetivo | "Atacar J5" / "Explorar J5" + "Confirmar · 1 acción" |
| Maniobrar | Select distancia (1–velocidad) + 4 flechas cardinales (N/S/E/O) |
| Terminar turno | Botón que gasta AP restante |

### 13.4 Modal de cortina de privacidad

En modo simulación (2 puestos en un dispositivo), al cambiar de jugador se muestra un overlay a pantalla completa con icono de escudo y texto **"CAMBIO DE PUESTO"** forzando al otro jugador a mirar hacia otro lado antes de revelar el tablero.

### 13.5 Responsive

| Breakpoint | Comportamiento |
|---|---|
| > 1000px | Ambos tableros visibles lado a lado |
| ≤ 1000px | Ajustes de espaciado |
| ≤ 650px | Tabs móviles: "Aguas rivales" / "Tu flota" (solo un tablero visible a la vez) |

---

## 14. Simulación y conectividad

### 14.1 Modo simulación

- Dos instancias de `TacticalGame` en el **mismo navegador**.
- Conectadas por cola de microtareas (no red).
- Cambio de puesto con cortina de privacidad.
- Sirve para probar reglas e interfaz, no demuestra conectividad.

### 14.2 Modo Wi-Fi (experimental)

- WebRTC DataChannel directo (ordenado, fiable).
- Sin servidor STUN/TURN/señalización.
- Intercambio manual de oferta/respuesta JSON.
- Timeout de emparejamiento: 120 segundos.
- Timeout de recolección ICE: 15 segundos.
- Candidatos host solamente (misma LAN).

### 14.3 Desconexión

- Detiene la partida; no recupera estado.
- Emparejamiento caduca a los 120s.
- Acción sin respuesta se detiene a los 15s.
- Es necesario crear nueva sesión.

---

## 15. Equilibrio de juego (valores ajustables)

Todos los valores de equilibrio están centralizados en `RULES` y `CATALOG` en el motor del juego.

| Constante | Valor | Efecto |
|---|---|---|
| `size` | 10 | Tamaño del tablero |
| `fleet` | 3 | Barcos por jugador |
| `budget` | 13 | Presupuesto máximo |
| `actions` | 2 | Acciones por turno |
| `repairRange` | 2 | Alcance Manhattan de reparación aliada |

> Estos valores están diseñados para ser fácilmente ajustables sin cambiar la lógica del motor.

---

## 16. Requisitos para nueva implementación (servidor + frontend)

### 16.1 Separación de responsabilidades

```
┌─────────────────────┐     ┌─────────────────────┐
│   SERVIDOR CENTRAL  │     │   FRONTEND CLIENTE  │
│                     │     │                     │
│ • Gestión de partidas│     │ • UI / renderizado   │
│ • Estado authoritative│   │ • Input del jugador  │
│ • Validación de      │     │ • Visualización de   │
│   acciones          │     │   tableros           │
│ • Emparejamiento    │     │ • Efectos visuales   │
│ • Persistencia      │     │ • Sin lógica de      │
│ • Anti-trampas      │     │   negocio auth       │
│ • matchmaking       │     │                     │
└─────────────────────┘     └─────────────────────┘
```

### 16.2 Lo que el servidor debe manejar

1. **Estado authoritative del juego:** El servidor es la fuente de verdad. El cliente solo envía intenciones.
2. **Validación completa:** Todas las reglas se validan server-side (posiciones, presupuesto, cooldowns, cargas, rango, colisiones).
3. **Información asimétrica:** El servidor envía a cada jugador solo lo que le corresponde ver.
4. **Gestión de sesiones:** Crear, emparejar, reconectar, persistir.
5. **Anti-trampas real:** A diferencia del modelo P2P actual, el servidor puede detectar y prevenir cualquier forma de trampa.

### 16.3 Lo que el frontend debe manejar

1. **Renderizado de tableros:** 10×10 con toda la visualización descrita.
2. **Interacción:** Colocación, selección, apuntado, maniobras.
3. **Comunicación con servidor:** WebSocket o HTTP para enviar acciones y recibir actualizaciones.
4. **UI state management:** Fases, turnos, AP, errores, toasts.
5. **Instalable:** PWA o app nativa con funcionamiento offline para reglas/catálogo.
6. **Sin lógica de negocio:** El frontend confía en el servidor para validar todo.

---

## 17. Glosario

| Término | Definición |
|---|---|
| AP | Puntos de Acción (Action Points) |
| PV | Puntos de Vida (Hit Points) |
| Torpedo | Ataque de línea de 3 celdas |
| Cañón | Ataque de 1 celda |
| Sonar | Habilidad de exploración (3×3) |
| Camuflaje | Oculta barco al sonar, no a ataques |
| Colisión | Barcos comparten celda (prohibido) |
| Adyacente | Barcos en celdas vecinas (permitido) |
| Hundido | Barco con PV = 0 |
| Flota | Conjunto de 3 barcos de un jugador |
| Presupuesto | Puntos totales disponibles para选购 barcos |
| Enfriamiento | Turnos de espera antes de reusar habilidad |
| Cargas | Usos restantes de una habilidad por partida |
| Epoch | Contador que se incrementa en revancha, invalida paquetes antiguos |
| Seq | Secuencia global de acciones |
| Manhattan | Distancia: |x1-x2| + |y1-y2| |
