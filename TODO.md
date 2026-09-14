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
- [ ] **Reexportar `submarine.png` a 210×70** (3 tramos) desde el fuente. Hoy es un reescalado del de 4 tramos, algo comprimido.
- [ ] **Iconos PNG 192/512 + maskable** para la instalación óptima de la PWA en Android (hoy solo hay SVG).
- [ ] **Sprite continuo del barco seleccionado** (opcional): hoy hay un contorno único, pero persiste el hueco entre celdas (`docs/` y conversación).
- [ ] **Historial de partidas y estadísticas** por usuario (fuera del MVP; el esquema ya guarda `games`, `game_players`, `game_events`).
- [ ] **Backlog de producto**: espectadores, torneos, más barcos/modos (`docs/06-roadmap.md`).

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
