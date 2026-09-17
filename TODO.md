# TODO — Pendientes para producción

Estado actual: **beta autoalojada** en un PC con Ubuntu + Tailscale Funnel (URL fija `https://ubuntu-server.tail797989.ts.net`). Este documento recoge lo que falta para pasar a **producción** de forma profesional.

Marcado como `[ ]` lo pendiente y `[x]` lo ya resuelto. Se irá actualizando.

---

## Bloqueantes para producción

### Correo y cuentas
- [ ] **Configurar un servidor SMTP real** para la recuperación de contraseña (Brevo, Resend, Amazon SES, Mailgun o Gmail con contraseña de aplicación). Hoy, sin SMTP, el enlace de restablecimiento se escribe en los logs del servidor. Variables: `SMTP_URL` y `MAIL_FROM` (ver `.env.example`).
- [ ] **Verificación de correo** al registrarse (el campo `users.email_verified` existe pero no se usa).
- [ ] **OAuth social** (Google/Apple), previsto en ADR-009 y no implementado.

### Infraestructura y despliegue
- [ ] **Decidir el hosting de producción** (VPS 24/7) y migrar desde el PC de casa. Opciones en `docs/11-vps-barato.md`, `docs/12-aws.md` y `docs/13-comparativa-hosting.md`.
- [ ] **Dominio propio + TLS.** Hoy la URL fija es de Tailscale (`*.ts.net`). Para producción: dominio + Caddy (`docs/07-despliegue.md`) o Cloudflare Named Tunnel (`docs/15-url-fija.md`).
- [ ] **Restringir `CORS_ORIGIN`** al dominio real (ahora `*`).
- [ ] **Backups automáticos de PostgreSQL** y prueba de restauración periódica (`docs/07-despliegue.md`).
- [ ] **Gestión de secretos** fuera del repositorio (variables de entorno del proveedor / gestor de secretos).

### Seguridad
- [ ] **Rate limit compartido en Redis** si se ejecuta más de una instancia (hoy es en memoria por proceso).
- [ ] **Sustituir el mutex en proceso por un bloqueo distribuido** si se escala a varias instancias (ADR-020).
- [ ] **Revisión de dependencias** (`pnpm audit`) y plan de actualizaciones.
- [ ] **Cabeceras de seguridad del frontend (CSP)** servidas por nginx/Caddy.
- [ ] **Limpieza periódica de tokens caducados** (refresh tokens y tokens de recuperación).
- [ ] **Verificar el bloqueo de `/metrics`** en el proxy de producción.

### Observabilidad y operación
- [ ] **Monitorización y alertas** (Prometheus/Grafana o servicio gestionado).
- [ ] **Captura de errores** (Sentry o similar).
- [ ] **Retención y privacidad de logs**: dejar de registrar enlaces de restablecimiento en cuanto haya SMTP.

---

## Mejoras recomendadas (no bloqueantes)

### Producto y UX
- [ ] **Decidir y registrar el modelo de monetización** (ver `docs/16-monetizacion.md`): freemium sin pay-to-win (cosméticos + suscripción + packs de contenido).
- [ ] **Telemetría de retención** antes de cobrar nada: tabla `analytics_events`, endpoint `POST /api/events` y panel de D1/D7/DAU (`docs/17-telemetria-retencion.md`).
- [ ] **Reexportar `submarine.png` a 210×70** (3 tramos) desde el fuente. Hoy es un reescalado del de 4 tramos, algo comprimido.
- [ ] **Iconos PNG 192/512 + maskable** para la instalación óptima de la PWA en Android (hoy solo hay SVG).
- [ ] **Sprite continuo del barco seleccionado** (opcional): hoy hay un contorno único, pero persiste el hueco entre celdas (`docs/` y conversación).
- [ ] **Historial de partidas y estadísticas** por usuario (fuera del MVP; el esquema ya guarda `games`, `game_players`, `game_events`).
- [ ] **Backlog de producto**: espectadores, torneos, más barcos/modos (`docs/06-roadmap.md`).

### Modalidades de juego
Actualmente solo existe la **partida en directo** (por turnos, ambos conectados, resolución inmediata). Añadir dos modalidades nuevas:

- [ ] **Partida diferida (asíncrona / por correspondencia).** Sin tiempo por turno: cada jugador mueve cuando quiere, **sin necesidad de conexión activa** ni de controlar si el rival está offline. El estado vive en el servidor y **solo se notifica al rival cuando el jugador en turno termina su turno** (notificación push / email).
  - Requiere: persistencia de partidas de larga duración (TTL amplio), notificaciones (Web Push y/o email), y separar el modelo de "partida en vivo" del de "partida persistente".
- [ ] **Partida por tiempo (reloj de ajedrez).** Cada jugador dispone de **"X" minutos para todas sus acciones a lo largo de la partida**; su contador **solo corre cuando es su turno**. Al agotarse, se pierde por tiempo.
  - Requiere: reloj autoritativo en el servidor (inicio/parada por turno), control de consumo por jugador, y condición de fin por tiempo agotado.

> Ambas afectan al **modelo de turnos y al protocolo** (hoy asumen partida en vivo con resolución inmediata). Conviene registrarlas como ADR antes de implementarlas.

### Administración
- [ ] **Portal de administración separado** (`apps/admin`) o herramienta de BI (Metabase/Grafana) contra una réplica de solo lectura, servido **solo por Tailscale** y con auth endurecida (MFA, audit log). Ver ADR-029. Hoy existe `/admin` dentro de la app (suficiente para la beta).
- [ ] **Historial y estadísticas para el usuario final** (no solo admin): sus partidas, resultados y evolución.

### Legal / RGPD
- [ ] **Política de privacidad y términos de uso.**
- [ ] **Revisar base legal, minimización de datos y plazos de retención.**
- [ ] **Exportación de datos del usuario** (el borrado de cuenta `DELETE /me` ya existe).

### Calidad y CI/CD
- [ ] **Activar el CD a producción** (secretos `VPS_*` en GitHub) y separar entornos staging/prod (`docs/07-despliegue.md`).
- [ ] **Ejecutar la prueba de carga k6** en staging y fijar umbrales (`tests/load/match.js`).
- [ ] **Revisar accesibilidad (a11y)** y contraste.
- [ ] **Internacionalización** (hoy solo español).

---

## Notas
- La URL fija actual (Tailscale Funnel) es válida mientras el PC esté encendido; no sustituye a un hosting 24/7 para producción.
- Cualquier cambio de contrato (REST/WS) debe actualizar `docs/05-protocolo.md` y sus pruebas.
- Registrar decisiones relevantes como ADR en `docs/01-decisiones.md`.
