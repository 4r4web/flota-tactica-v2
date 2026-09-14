# 15 — URL fija (siempre la misma)

Por defecto, el *quick tunnel* de Cloudflare y `localhost.run` generan una **URL aleatoria** que cambia al reiniciar. Para tener una **URL fija**, hay tres vías; elige según tengas dominio y según tu operador.

| Opción | Coste | Dominio | Abrir puertos | IP pública | Dificultad |
|---|---|---|---|---|---|
| **A. Tailscale Funnel** | 0 | No | No | No | Baja |
| **B. Cloudflare Named Tunnel** | Dominio (~10 €/año) | Sí | No | No | Media |
| **C. DuckDNS + puertos + Caddy** | 0 | No (subdominio gratis) | Sí (80/443) | Sí (sin CGNAT) | Media |

---

## Opción A — Tailscale Funnel (recomendada)

**Gratis, sin dominio y sin tocar el router.** Da una URL estable tipo
`https://<equipo>.<tu-tailnet>.ts.net`. Funciona detrás de NAT/CGNAT.

1. Con el stack de la beta ya en marcha (`bash scripts/setup-home.sh`), ejecuta:

   ```bash
   bash scripts/funnel-tailscale.sh
   ```

   El script instala Tailscale, te conecta (abre el navegador para iniciar sesión con una cuenta gratuita) y habilita Funnel en el puerto 8080.

2. Copia la URL que muestra `tailscale funnel status` (por ejemplo
   `https://flota-pc.tailXXXX.ts.net`) y compártela. **Es fija.**

3. Comprueba `https://<equipo>.<tailnet>.ts.net/health`.

**Notas**
- La primera vez puede pedirte habilitar **Funnel** en el panel de administración de Tailscale (gratis).
- Estable mientras el PC esté encendido y en el tailnet.
- Para desactivar: `sudo tailscale funnel --bg off`.
- Arranque automático: `sudo systemctl enable --now tailscaled` (normalmente ya activo) y la configuración de Funnel persiste.

---

## Opción B — Cloudflare Named Tunnel + dominio propio

Requiere un **dominio** añadido a **Cloudflare** (plan gratuito). Da la URL más “marca”: `https://flota.tudominio.com`.

```bash
# Instalar cloudflared (si no lo tienes)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared

# Autenticar y crear el túnel
~/.local/bin/cloudflared tunnel login
~/.local/bin/cloudflared tunnel create flota

# Asociar el subdominio a la URL
~/.local/bin/cloudflared tunnel route dns flota flota.tudominio.com
```

Crea `~/.cloudflared/config.yml`:

```yaml
tunnel: <UUID-del-tunel>
credentials-file: /home/<usuario>/.cloudflared/<UUID-del-tunel>.json
ingress:
  - hostname: flota.tudominio.com
    service: http://localhost:8080
  - service: http_status:404
```

Arranca el túnel (y en arranque con systemd si quieres):

```bash
~/.local/bin/cloudflared tunnel run flota
# o: sudo cloudflared service install
```

URL fija: **https://flota.tudominio.com**

---

## Opción C — DuckDNS + reenvío de puertos + Caddy

**Gratis** con un subdominio propio (`flota-tactica.duckdns.org`). Requiere **IP pública** (si tu operador usa CGNAT, no funciona) y **abrir 80/443** en el router.

1. Crea el subdominio en [duckdns.org](https://www.duckdns.org) y apunta su IP a la de tu casa.
2. En el router, reenvía **80** y **443** a la IP local del PC.
3. Usa el compose de producción con Caddy (TLS automático):

   ```bash
   # En .env.prod:
   #   DOMAIN=flota-tactica.duckdns.org
   #   CORS_ORIGIN=https://flota-tactica.duckdns.org
   docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build
   docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
   ```

URL fija: **https://flota-tactica.duckdns.org**

---

## Comparativa rápida

- **¿No tienes dominio y quieres cero complicaciones?** → **Opción A (Tailscale Funnel)**.
- **¿Tienes (o quieres comprar) un dominio propio?** → **Opción B (Cloudflare Named Tunnel)**.
- **¿Tienes IP pública y te apañas con el router?** → **Opción C (DuckDNS + Caddy)**.
