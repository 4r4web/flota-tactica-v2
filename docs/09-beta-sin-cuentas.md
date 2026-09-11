# 09 — Beta sin cuentas (túnel local)

Alternativas para publicar la beta **sin crear cuentas ni tokens**. La más directa es ejecutar el stack completo en tu equipo y exponerlo con un túnel gratuito.

> Limitación común: el equipo debe estar encendido y con conexión. Para una beta entre amigos es perfectamente válido.

---

## Opción A — Local + túnel gratuito (recomendada)

**Ventajas:** coste 0, sin registros, WebSocket estable, mismo stack que producción.
**Inconveniente:** solo está disponible mientras tu equipo esté encendido.

### Pasos

1. Instala **Docker** y **Docker Compose**.
2. Clona el repositorio y entra en él.
3. Crea el fichero de entorno:

   ```bash
   cp .env.prod.example .env.prod
   # Edita JWT_SECRET con una cadena larga y aleatoria (y POSTGRES_PASSWORD)
   ```

4. Levanta el stack (PostgreSQL, Redis, servidor y web):

   ```bash
   docker compose --env-file .env.prod -f docker/compose.tunnel.yml up -d --build
   docker compose --env-file .env.prod -f docker/compose.tunnel.yml run --rm server node dist/db/migrate.js
   ```

   La web queda en `http://localhost:8080`.

5. Abre el túnel:

   ```bash
   bash scripts/tunnel.sh
   ```

   - Con **cloudflared** instalado, crea una URL `https://<aleatorio>.trycloudflare.com`.
   - Sin cloudflared, usa **localhost.run** por SSH: `https://<aleatorio>.lhr.life`.

6. Comparte esa URL. Es HTTPS, así que la PWA se puede instalar en el móvil.

### Notas

- **CORS:** con una URL aleatoria, deja `CORS_ORIGIN=*` (usamos tokens Bearer, no cookies). Para restringirlo, pon la URL del túnel.
- **URL estable:** el quick tunnel cambia en cada reinicio. Para una URL fija usa un túnel con nombre de Cloudflare (cuenta gratuita) o DuckDNS con reenvío de puertos en tu router.
- **Actualizar:** `git pull` y repite el paso 4 (`up -d --build`).
- **Parar:** `docker compose --env-file .env.prod -f docker/compose.tunnel.yml down`.

---

## Opción B — GitHub Codespaces

Usa tu cuenta de GitHub (sin registros nuevos). El plan gratuito incluye **120 core-horas al mes** (un Codespace de 2 núcleos ≈ 60 h).

1. Abre el repositorio en un Codespace.
2. Ejecuta el stack (Docker está disponible dentro del Codespace).
3. En la pestaña **Ports**, haz público el puerto `8080` y usa la URL `https://<codespace>-8080.app.github.dev`.

**Inconveniente:** el Codespace se detiene por inactividad y consume horas del plan gratuito.

---

## Opción C — PaaS gratuitos con registro

Plataformas como **Koyeb**, **Render** o **Northflank** tienen capas gratuitas. Para el juego:

- Necesitan PostgreSQL y Redis gestionados (sus planes gratuitos o Neon/Upstash).
- **Cuidado:** los servicios gratuitos que se duermen por inactividad **cortan el WebSocket** y arruinan las partidas. Koyeb permite desactivar el *scale to zero*.

Solo tiene sentido si aceptas crear cuentas en esas plataformas.

---

## Opción D — Cloudflare Workers + Durable Objects (a futuro)

Es la opción **siempre gratis y siempre encendida** ideal para WebSocket, sin base de datos externa (Durable Objects + almacenamiento). A cambio, exige **reescribir el servidor** para el runtime de Workers (no es Node/Fastify). Es un trabajo considerable que puede abordarse tras validar la beta.

---

## Comparativa rápida

| Opción | Coste | Cuentas | Siempre activo | WebSocket | Esfuerzo |
|---|---|---|---|---|---|
| A — Local + túnel | 0 | Ninguna | No (tu equipo) | Sí | Ninguno |
| B — Codespaces | 0 (con límite) | GitHub | No (inactividad) | Sí | Bajo |
| C — PaaS free | 0 | Varias | A veces duerme | Riesgo de corte | Bajo |
| D — Cloudflare Workers | 0 | Cloudflare | Sí | Sí | Alto (reescritura) |
