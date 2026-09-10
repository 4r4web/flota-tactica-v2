# 08 — Beta con coste 0 (Oracle Cloud Always Free)

Guía para publicar la beta sin coste usando **Oracle Cloud Always Free** (VM ARM) y un **subdominio gratuito** con TLS automático. Complementa la [guía de despliegue](07-despliegue.md).

---

## 1. Por qué esta opción

- **Siempre gratis:** la capa *Always Free* de Oracle incluye una VM Ampere A1 (ARM) de hasta **4 OCPU y 24 GB de RAM**, 200 GB de disco y 10 TB de salida al mes.
- **Persistente:** mantiene conexiones **WebSocket** abiertas, a diferencia de los hosts gratuitos que se duermen.
- **Sin cambios de código:** ejecuta el mismo `docker compose` de producción (PostgreSQL, Redis, servidor, web y Caddy).
- **TLS gratis:** Caddy obtiene un certificado Let's Encrypt para un subdominio gratuito.

> La VM es **ARM64**. Las imágenes del CD se construyen multi-arquitectura (`amd64` + `arm64`), y en la VM se puede compilar en local sin registro.

---

## 2. Crear la VM

1. Crea una cuenta en [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).
2. **Compute → Instances → Create instance**:
   - **Image:** Ubuntu 22.04 o 24.04 (aarch64).
   - **Shape:** `VM.Standard.A1.Flex` (Ampere ARM), 2–4 OCPU y 8–24 GB.
   - **Networking:** asigna una **IP pública reservada** (para que el subdominio no cambie).
   - **SSH keys:** sube tu clave pública.
3. Anota la **IP pública**.

### Abrir los puertos en la Security List

En **Networking → VCN → Security Lists → Default Security List**, añade reglas de entrada:

| Origen | Protocolo | Puerto |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

---

## 3. Preparar la VM

Conéctate por SSH y ejecuta el script de arranque (instala Docker y abre el firewall local):

```bash
ssh ubuntu@<IP>
git clone https://github.com/4r4web/flota-tactica-v2.git
cd flota-tactica-v2
sudo bash scripts/bootstrap-oracle.sh
```

> Las imágenes Ubuntu de Oracle bloquean 80/443 en `iptables` además de la Security List; el script lo resuelve.

---

## 4. Subdominio gratuito

### Opción A — sslip.io (sin registro)

Usa la IP directamente como subdominio: `<IP>.sslip.io`. Por ejemplo, para `129.146.10.20`:

```
DOMAIN=129.146.10.20.sslip.io
CORS_ORIGIN=https://129.146.10.20.sslip.io
```

### Opción B — DuckDNS (nombre fijo)

1. Entra en [duckdns.org](https://www.duckdns.org) y crea un subdominio, p. ej. `flota-tactica`.
2. Apunta su IP a la de la VM.
3. Configura:

```
DOMAIN=flota-tactica.duckdns.org
CORS_ORIGIN=https://flota-tactica.duckdns.org
```

---

## 5. Configurar y arrancar

```bash
cp .env.prod.example .env.prod
# Edita .env.prod: DOMAIN, CORS_ORIGIN, POSTGRES_PASSWORD, JWT_SECRET

docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
```

Caddy solicita el certificado al primer arranque (puede tardar unos segundos).

Verifica:

```bash
curl https://<DOMAIN>/health
```

Abre `https://<DOMAIN>` en el móvil e instálala como PWA.

---

## 6. Límites recomendados para la beta

Al ser una beta con recursos limitados, conviene endurecer los límites en `.env.prod`:

```
RATE_LIMIT_MAX=60
RATE_LIMIT_WINDOW=1 minute
AUTH_RATE_LIMIT_MAX=5
BODY_LIMIT=8192
```

La página **`https://<DOMAIN>/status`** muestra el estado del servicio (servidor, PostgreSQL, Redis, conexión WebSocket, versión y tiempo activo) para que los testers puedan comprobar la disponibilidad.

---

## 7. Actualizar la beta

```bash
cd flota-tactica-v2
git pull
docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
```

---

## 8. Despliegue continuo (opcional)

El workflow `deploy.yml` publica imágenes multi-arquitectura en GHCR y despliega por SSH. Para usarlo con Oracle:

1. En GitHub, define los secretos `VPS_HOST`, `VPS_USER` (`ubuntu`), `VPS_SSH_KEY` y `VPS_PATH`.
2. Haz **públicos** los paquetes `flota-server` y `flota-web` en GHCR, o crea en la VM un token de solo lectura de paquetes.
3. Cambia en `.env.prod` las imágenes por las de GHCR:

```
SERVER_IMAGE=ghcr.io/4r4web/flota-server:latest
WEB_IMAGE=ghcr.io/4r4web/flota-web:latest
```

---

## 9. Límites y notas

- La capa *Always Free* es **real y sin caducidad**, pero Oracle puede reclamar recursos si la VM está inactiva; mantén un uso mínimo.
- El ancho de banda de salida es de 10 TB/mes (de sobra para la beta).
- No hay alta disponibilidad: la beta puede tener cortes. Los backups de PostgreSQL son responsabilidad tuya (ver [guía de despliegue](07-despliegue.md)).
- Cuando la beta esté validada, se puede migrar a un VPS de pago sin cambios de código (mismas imágenes).

---

## 10. Alternativas gratuitas

Si no consigues aprovisionar la VM ARM de Oracle:

- **GCP e2-micro Always Free:** VM pequeña (1 GB). Conviene mover PostgreSQL y Redis a servicios gestionados gratuitos (Neon + Upstash).
- **Neon + Upstash + Koyeb/Render:** gestionados gratuitos, pero el servidor free puede dormirse y cortar partidas.
- **Cloudflare Workers + Durable Objects:** excelente para WebSocket y gratis con límites, pero requiere reescribir el servidor al runtime de Workers.
