# 10 — Beta en Raspberry Pi

Una Raspberry Pi es una opción **excelente** para una beta con unos pocos testers: es ARM64 (las imágenes ya son multi-arquitectura), consume muy poco y, al ser un juego por turnos, la carga es mínima.

---

## 1. ¿Es suficiente?

| Modelo | Recomendación |
|---|---|
| **Raspberry Pi 5 (4/8 GB)** | Ideal |
| **Raspberry Pi 4 (4/8 GB)** | Perfecta para una beta pequeña |
| Raspberry Pi 4 (2 GB) | Viable con poco margen |
| Raspberry Pi 3 | Funciona, más lenta (compilación y arranque) |

El stack completo (PostgreSQL, Redis, servidor Node, nginx) usa unos cientos de MB en reposo. Unas pocas partidas simultáneas no suponen problema.

---

## 2. Hardware recomendado

- **Alimentación estable** (fuente oficial; evita cortes que corrompan la base de datos).
- **Almacenamiento:** mejor un **SSD por USB 3.0** que una microSD. PostgreSQL escribe con frecuencia y desgasta las tarjetas SD.
- **Refrigeración:** disipador o ventilador para evitar el *throttling* térmico.
- Conexión por **cable Ethernet** (más estable que Wi-Fi).

---

## 3. Sistema operativo

Usa un SO **de 64 bits**:

- **Raspberry Pi OS (64-bit)**, o
- **Ubuntu Server 24.04 LTS (arm64)**.

Con Raspberry Pi Imager: elige la imagen de 64 bits y configura usuario, Wi-Fi y SSH desde el propio asistente.

---

## 4. Instalar Docker

```bash
git clone https://github.com/4r4web/flota-tactica-v2.git
cd flota-tactica-v2
sudo bash scripts/bootstrap-docker.sh
# Cierra y reabre la sesión para usar docker sin sudo
```

---

## 5. Desplegar el stack

```bash
cp .env.prod.example .env.prod
# Edita JWT_SECRET (cadena larga) y POSTGRES_PASSWORD

# Accesible desde la red local:
LOCAL_BIND=0.0.0.0 docker compose --env-file .env.prod -f docker/compose.tunnel.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.tunnel.yml run --rm server node dist/db/migrate.js
```

- En la Pi (compilación local): la primera vez tarda unos minutos.
- Accede desde la red local en `http://<ip-de-la-pi>:8080` (obtén la IP con `hostname -I`).

> La PWA **no se puede instalar en iPhone** por HTTP; para eso necesitas HTTPS (túnel, siguiente sección). En Android puede funcionar, pero es mejor usar HTTPS.

---

## 6. Exponer a Internet (testers fuera de casa)

La forma más sencilla y sin abrir puertos en el router es un **túnel**:

### cloudflared (recomendado)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
pnpm beta:tunnel
```

Da una URL `https://<aleatorio>.trycloudflare.com`. Para una URL fija, crea un **túnel con nombre** en Cloudflare (cuenta gratuita) y un dominio.

### localhost.run (sin instalar nada)

```bash
ssh -o StrictHostKeyChecking=accept-new -R 80:localhost:8080 nokey@localhost.run
```

### Mantener el túnel tras reinicios

Usa el servicio systemd de ejemplo `scripts/flota-tunnel.service`:

```bash
sudo cp scripts/flota-tunnel.service /etc/systemd/system/flota-tunnel.service
# Edita User, WorkingDirectory y el comando del túnel
sudo systemctl daemon-reload
sudo systemctl enable --now flota-tunnel
journalctl -u flota-tunnel -f
```

Los contenedores ya tienen `restart: unless-stopped`, así que vuelven solos tras un reinicio.

---

## 7. Actualizar

```bash
cd flota-tactica-v2
git pull
LOCAL_BIND=0.0.0.0 docker compose --env-file .env.prod -f docker/compose.tunnel.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.tunnel.yml run --rm server node dist/db/migrate.js
```

---

## 8. Copias de seguridad

```bash
docker compose --env-file .env.prod -f docker/compose.tunnel.yml exec postgres \
  pg_dump -U flota flota | gzip > backup-$(date +%F).sql.gz
```

Guarda los backups **fuera de la Pi** (otro equipo o la nube). Si usas SSD, la base de datos es más segura, pero un backup externo sigue siendo imprescindible.

---

## 9. Consejos

- **CORS:** con URL de túnel aleatoria, deja `CORS_ORIGIN=*`. Si fijas un dominio, restringirlo.
- **Límites:** para una beta, aplica los valores recomendados en la [guía de beta gratuita](08-beta-gratuita.md#6-límites-recomendados-para-la-beta).
- **Estado:** consulta `https://<url>/status` para ver salud y versión.
- **Monitorización:** `docker stats` para ver CPU/RAM; `vcgencmd measure_temp` para la temperatura.
- **Almacenamiento:** vigila el espacio (`df -h`); los logs de Docker pueden crecer (`docker system prune` de vez en cuando).

---

## 10. Resumen

| Aspecto | Valoración |
|---|---|
| Coste | 0 si ya tienes la Pi |
| Cuentas necesarias | Ninguna (salvo Cloudflare/DuckDNS si quieres URL fija) |
| Capacidad | Unas pocas partidas simultáneas |
| WebSocket | Sí, estable |
| HTTPS | Sí, vía túnel |
| Punto débil | Cortes de luz/red domésticos y desgaste de la microSD |

Es una forma muy razonable de validar la beta antes de decidir un hosting de pago.
