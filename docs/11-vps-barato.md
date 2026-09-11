# 11 — VPS barato (Dinahosting y similares)

Un **VPS** barato es la opción más cercana a producción y encaja sin cambios con lo ya construido (`docker/compose.prod.yml` + Caddy + CD). Requiere invertir un poco de dinero, a cambio de disponibilidad real.

> **Importante:** el **hosting compartido** (los planes más baratos de cualquier proveedor) **no sirve**. No permite procesos Node persistentes, ni WebSocket, ni Docker. Debes contratar un **VPS**.

---

## 1. Qué necesitas

| Requisito | Valor |
|---|---|
| Tipo | **VPS** con acceso root (KVM/VM, no contenedor restringido) |
| CPU / RAM | 2 vCPU / **2 GB** (1 GB funciona, pero justo) |
| Disco | 20 GB SSD |
| Sistema | Ubuntu 22.04 o 24.04 LTS |
| Red | Puertos **80 y 443** abiertos |
| Dominio | Uno propio (se puede comprar en el mismo proveedor) |

El stack completo (PostgreSQL, Redis, Node, nginx, Caddy) consume unos cientos de MB en reposo.

---

## 2. Dinahosting (u otro proveedor)

1. Contrata un plan **VPS** (no hosting compartido).
2. Al crearlo, elige **Ubuntu LTS** y guarda el acceso root/SSH.
3. Añade tu **dominio** y crea un registro **A** apuntando a la **IP del VPS**.

Otros proveedores equivalentes: Hetzner (muy buena relación calidad/precio), OVH, Scaleway, DigitalOcean, Vultr.

---

## 3. Puesta en marcha

Reutiliza la [guía de despliegue](07-despliegue.md) y el script genérico:

```bash
ssh root@<IP-del-vps>
git clone https://github.com/4r4web/flota-tactica-v2.git
cd flota-tactica-v2
sudo bash scripts/bootstrap-docker.sh

cp .env.prod.example .env.prod
# Edita: DOMAIN=tu-dominio.com, CORS_ORIGIN=https://tu-dominio.com,
#        JWT_SECRET (cadena larga), POSTGRES_PASSWORD

docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
```

Caddy solicita el certificado TLS de tu dominio automáticamente. Comprueba `https://tu-dominio.com/health` y `https://tu-dominio.com/status`.

---

## 4. Despliegue continuo (opcional)

El workflow `deploy.yml` publica imágenes multi-arquitectura en GHCR y despliega por SSH. Configura en GitHub los secretos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` y `VPS_PATH`, y haz públicos los paquetes de GHCR (o crea un token de solo lectura en el VPS). A partir de ahí, cada push a `main` actualiza la beta.

---

## 5. Coste orientativo

| Concepto | Coste |
|---|---|
| VPS pequeño (2 vCPU / 2 GB) | ~5–10 €/mes |
| Dominio | ~10 €/año |

Frente a las alternativas gratuitas (Oracle Always Free, Raspberry Pi o túnel local), el VPS aporta disponibilidad 24/7 y menos mantenimiento, sin cambiar nada del código.

---

## 6. Notas

- Elige la **ubicación** del servidor cerca de tus testers (menor latencia).
- Programa **backups** de PostgreSQL (ver [guía de despliegue](07-despliegue.md)).
- La mayoría de VPS baratos son **amd64**; las imágenes soportan `amd64` y `arm64`.
- Si el VPS trae 1 GB de RAM, mueve PostgreSQL/Redis a servicios gestionados o sube a 2 GB.
