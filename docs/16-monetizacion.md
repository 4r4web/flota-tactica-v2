# 16 — Monetización

Análisis de modelos de monetización para Flota Táctica, con casos de éxito y una recomendación alineada con el tipo de juego.

> Este documento es una guía estratégica. Las decisiones que se adopten deberían registrarse como ADR.

---

## 1. Punto de partida (qué es el juego)

| Característica | Implicación para monetizar |
|---|---|
| 1v1 por turnos, partidas de 10–20 min | Sesiones cortas; encaja con F2P, pases y suscripción |
| Reglas deterministas y catálogo fijo | **No hay pay-to-win posible sin romper el juego** |
| Web/PWA instalable, sin tienda de apps | Pagos con Stripe; se evitan (de momento) las comisiones y reglas de Apple/Google |
| Cuentas con email/OAuth | Base para perfiles, estadísticas y tienda |
| Sin progresión ni economía todavía | Hay que **crear** los ganchos antes de cobrar |
| Competitivo y de habilidad | Monetizar **cosmética, conveniencia y contenido**, nunca ventaja |

**Principio rector:** en un juego competitivo 1v1, vender ventaja destruye la comunidad. Todo lo que se cobre debe ser cosmético, de conveniencia o de contenido.

---

## 2. Modelos posibles y su encaje

| Modelo | Cómo funciona | Encaje aquí | Riesgo |
|---|---|---|---|
| **Premium (pago único)** | Pagar para jugar | Medio: en web es difícil de cerrar sin fricción; limita el alcance | Barrera de entrada |
| **F2P + anuncios** | Gratis con publicidad | Medio: ingresos bajos por usuario, necesita volumen | Mala UX; poco digno para un juego táctico |
| **Cosméticos / IAP** | Skins, temas, marcadores, emotes | **Alto**: no rompe el equilibrio | Necesita arte y tienda |
| **Pase de temporada** | Recompensas cosméticas por jugar | Medio-alto: requiere progresión/rangos | Exige bucles de retención |
| **Suscripción** | Cuota mensual por extras | **Alto**: encaja con stats, ranked, análisis, sin anuncios | Hay que dar valor continuo |
| **Expansiones / contenido** | Nuevos barcos, mapas, modos | **Alto**: contenido claro y vendible | Hay que diseñarlo y equilibrarlo |
| **Donaciones** | Ko-fi/Patreon | Bajo: fácil, pero poco escalable | Depende de la comunidad |
| **Torneos de pago** | Inscripción con premio | Bajo (de momento): exige masa crítica y legalidad | Regulación (juego/azar) |
| **B2B / educación** | Licencia para aulas | Medio: el juego enseña probabilidad y táctica | Ciclo de venta lento |
| **Juego físico + Kickstarter** | Tablero real | Medio: encaja con el tema naval | Otro negocio distinto |

---

## 3. Casos de éxito y qué extraer

### 3.1 Ajedrez online — **Chess.com** y **Lichess**
- **Chess.com:** gratis con anuncios; **suscripción** (Gold/Platino/Diamante) que desbloquea lecciones, puzles, análisis y quita anuncios. Es el mejor espejo: **1v1, por turnos, habilidad pura**.
- **Lichess:** 100% gratis y de código abierto, financiado por **donaciones** (Patreon). Demuestra que una comunidad fuerte puede sostener un 1v1 sin cobrar.
- **Lección:** el núcleo competitivo gratis + **suscripción por herramientas** (análisis, estadísticas, aprendizaje) funciona muy bien en juegos de habilidad.

### 3.2 Aprendizaje gamificado — **Duolingo**
- Freemium: gratis con anuncios; **Super** quita anuncios y añade ventajas de conveniencia (no de habilidad).
- **Lección:** vender **conveniencia** (sin anuncios, más comodidad) es aceptable y no rompe la equidad.

### 3.3 F2P con cosméticos — **Among Us**, **Brawl Stars**, **Fall Guys**
- **Among Us:** premium barato en móvil/PC + **cosméticos**; éxito masivo.
- **Brawl Stars / Fall Guys:** gratis, **tienda cosmética** y **pase de temporada**, sin anuncios y sin vender poder.
- **Lección:** los **cosméticos** y el **pase** sostienen F2P sin pay-to-win. Requieren arte y rotación de contenido.

### 3.4 Coleccionables — **Hearthstone**, **Marvel Snap**, **Clash Royale**
- F2P con **pases** y **sobres/cartas**. Muy rentables, pero basados en **colección y progresión** (nuestro juego no tiene).
- **Lección:** sin un sistema de colección, **no copiar el modelo de gacha**; sí el **pase cosmético**.

### 3.5 Indie premium — **Slay the Spire**, **Into the Breach**
- Pago único, sin trampas. Grandes éxitos, pero son **un jugador**.
- **Lección:** el premium funciona cuando el contenido es rico y se percibe "de pago"; un 1v1 online necesita además servidores.

### 3.6 Adaptaciones de juegos de mesa — **Catan Universe**, **Ticket to Ride**
- **Premium + expansiones** (IAP) y, en algunos casos, anuncios. Vendibles por **contenido**.
- **Lección:** vender **packs de contenido** (mapas, barcos, modos) es natural y aceptado.

### 3.7 Físico — **Captain Sonar** y otros navales
- Juegos navales tácticos financiados por **Kickstarter** con gran éxito.
- **Lección:** a futuro, un **juego de mesa físico** puede ser un producto paralelo con su propia comunidad.

### 3.8 **Wordle**
- Gratis, sin anuncios ni cuentas; adquirido por NYT y monetizado dentro de su **suscripción**.
- **Lección:** un juego gratuito y limpio puede ser un **imán** que alimente un producto mayor.

---

## 4. Qué encaja mejor: **freemium sin pay-to-win**

Modelo recomendado, por capas:

1. **Núcleo gratis y completo.** Jugar 1v1 online, todo el catálogo y las reglas. Es el motor de la comunidad.
2. **Cosméticos (tienda).** Skins de barcos, temas de tablero, marcadores de impacto/agua, insignias, emotes. Nunca afectan al juego.
3. **Suscripción opcional ("Almirante").** Estadísticas avanzadas, historial y repeticiones, rangos/ligas, tableros personalizados, **sin anuncios**. Estilo Chess.com.
4. **Packs de contenido.** Nuevas clases de barco, mapas/escenarios y modos (p. ej. 2v2, campaña). Pago único o incluidos en la suscripción.
5. **Anuncios discretos (opcional)** en el nivel gratuito, **eliminables** con la suscripción.

Esto maximiza alcance (gratis), respeta la equidad competitiva (nada de pay-to-win) y ofrece varias vías de ingreso que se refuerzan entre sí.

---

## 5. Hoja de ruta de monetización

| Fase | Objetivo | Requisitos |
|---|---|---|
| **0 — Ahora (beta)** | Validar el juego y la retención | Métricas de uso, feedback, partidas completadas |
| **1 — Identidad** | Perfiles, estadísticas básicas, rangos | Retención demostrada |
| **2 — Cosméticos** | Tienda + Stripe + inventario | Arte de skins/temas; economía de moneda blanda |
| **3 — Suscripción** | Plan "Almirante" (stats, ranked, sin anuncios) | Valor continuo; facturación recurrente |
| **4 — Contenido** | Packs de barcos/mapas/modos | Diseño y equilibrio; pipeline de assets |
| **5 — Expansión** | Torneos, B2B/educación, juego físico | Comunidad y capacidad operativa |

No conviene cobrar antes de tener **retención**: primero que la gente vuelva a jugar, después monetizar.

---

## 6. Riesgos y consideraciones legales

- **Pay-to-win:** prohibido en la práctica. Cualquier ventaja de juego destruiría el 1v1.
- **Loot boxes / azar:** evitar o tratarlas como apuestas; hay regulación en varios países y riesgo reputacional.
- **Pagos:** **Stripe** en web (tarjeta, Apple/Google Pay). Si algún día se empaqueta como app nativa, aplican las comisiones y reglas de Apple/Google (IAP obligatorio para bienes digitales).
- **Menores y RGPD:** consentimiento, minimización y control parental si hay público joven; cuidado con compras.
- **Impuestos y facturación:** IVA/ventas, facturas, contabilidad; valorar un Merchant of Record (p. ej. Paddle/Lemon Squeezy) para delegar impuestos.
- **Reembolsos y soporte:** política clara desde el primer cobro.

---

## 7. Recomendación resumida

- **Modelo:** freemium sin pay-to-win → **cosméticos + suscripción opcional + packs de contenido**.
- **Inspiración principal:** **Chess.com** (1v1 de habilidad con suscripción) y **Catan/Ticket to Ride** (contenido vendible).
- **Primer paso realista:** cuando haya retención, montar una **tienda cosmética** (Stripe) y un plan de suscripción con estadísticas y "sin anuncios".
- **Registrar** la decisión como ADR y añadir los pendientes técnicos a `TODO.md`.
