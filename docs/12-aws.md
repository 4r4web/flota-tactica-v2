# 12 — Equivalente en AWS

El equivalente a un VPS barato en AWS es **Amazon Lightsail** (lo más simple) o **Amazon EC2** (más control). El stack ya se despliega en cualquier Ubuntu con Docker; no hay que cambiar código.

> **Aviso sobre el *free tier*:** desde 2025, las cuentas nuevas de AWS ya no incluyen 12 meses de EC2 `t2.micro`; el modelo pasó a **créditos** (válidos unos meses). Por tanto, en AWS conviene hablar de "barato", no de "gratis".

---

## 1. Opción recomendada: Amazon Lightsail

Es un VPS con **precio fijo**, IP estática incluida, firewall propio, DNS y snapshots. Lo más parecido a un VPS tradicional.

1. Crea una instancia **Ubuntu 22.04/24.04 LTS**.
2. Elige un plan de **2 GB de RAM** (el de 1 GB funciona, pero justo).
3. En la pestaña **Networking**, abre los puertos **80** y **443**.
4. Asigna una **IP estática**.

Plan orientativo: 2 GB ≈ **10–12 $/mes** (incluye varios TB de transferencia).

---

## 2. Opción con más control: Amazon EC2

- Instancia **`t4g.small`** (ARM Graviton, 2 vCPU / 2 GB) o `t3.small` (x86).
- AMI **Ubuntu LTS**.
- **Security Group** con entrada 80/443.
- **Elastic IP** asociada.
- Precio orientativo `t4g.small`: **~12 $/mes** bajo demanda (menos con *Savings Plans* o *Spot*) + disco EBS + transferencia.

> Las instancias `t4g` son **arm64**, así que las imágenes multi-arquitectura del proyecto corren nativas.

---

## 3. Base de datos y caché

Para una beta barata, **ejecuta PostgreSQL y Redis en la misma instancia** (como hace el `docker compose` del proyecto).

- **RDS** (PostgreSQL) y **ElastiCache** (Redis) son servicios gestionados cómodos pero **caros**; ElastiCache no entra en ninguna capa gratuita.
- Solo tiene sentido moverlos a gestionados si la beta crece o necesitas alta disponibilidad.

---

## 4. Qué evitar en AWS para este caso

| Servicio | Por qué no |
|---|---|
| **App Runner** | Soporte de WebSocket limitado; pensado para APIs HTTP. |
| **ECS Fargate** | Requiere ALB para WebSocket y almacenamiento persistente aparte; más caro y complejo. |
| **Elastic Beanstalk** | Capa PaaS con coste y complejidad añadidos. |
| **API Gateway + Lambda** | No encaja con WebSocket persistente de partidas largas (límites de conexión/tiempo). |
| **RDS + ElastiCache** | Encarecen una beta pequeña sin aportar valor todavía. |

---

## 5. Red y dominio

- **Firewall:** Security Group (EC2) o Networking (Lightsail) con **80** y **443**.
- **IP fija:** Elastic IP (EC2) o IP estática (Lightsail).
- **DNS:** Route 53 (zona alojada ≈ 0,50 $/mes) o el registrador donde tengas el dominio.
- **TLS:** Caddy lo obtiene automáticamente para tu dominio (no hace falta Certificate Manager con el proxy propio).

---

## 6. Puesta en marcha

Igual que en la [guía de VPS barato](11-vps-barato.md):

```bash
ssh ubuntu@<IP>
git clone https://github.com/4r4web/flota-tactica-v2.git
cd flota-tactica-v2
sudo bash scripts/bootstrap-docker.sh
cp .env.prod.example .env.prod     # DOMAIN, CORS_ORIGIN, JWT_SECRET, POSTGRES_PASSWORD
docker compose --env-file .env.prod -f docker/compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker/compose.prod.yml run --rm server node dist/db/migrate.js
```

En EC2, añade tu usuario al grupo `docker` (lo hace el script) y cierra/reabre la sesión.

---

## 7. Despliegue continuo

El workflow `deploy.yml` publica imágenes multi-arquitectura en GHCR y despliega por SSH. Configura los secretos `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` y `VPS_PATH`, y haz públicos los paquetes de GHCR (o usa un token de solo lectura).

---

## 8. Comparativa de coste

| Opción | Coste orientativo | Notas |
|---|---|---|
| **Lightsail 2 GB** | ~10–12 $/mes | Lo más simple en AWS; IP estática incluida |
| **EC2 t4g.small** | ~12 $/mes + EBS | Más control; ARM Graviton |
| RDS Postgres + ElastiCache | +30–60 $/mes | Innecesario para la beta |
| VPS europeo (Hetzner/Dinahosting/OVH) | 5–10 €/mes | Suele salir más barato |
| Oracle Always Free | 0 € | Siempre gratis (si consigues aprovisionar) |

**Conclusión:** en AWS, **Lightsail** es el equivalente más directo a un VPS barato. Si el objetivo es minimizar coste, un VPS europeo o Oracle Always Free suele salir mejor; si ya trabajas en AWS, Lightsail es la vía sencilla.
