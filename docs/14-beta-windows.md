# 14 — Alojar la beta en un PC con Windows

Sí. Con **Docker Desktop** (backend WSL2) se ejecuta el **mismo stack** que en Linux. El PC debe permanecer encendido mientras quieras que la beta esté disponible.

---

## 1. Requisitos

- Windows 10/11 de 64 bits.
- **Docker Desktop** con el backend **WSL2** ([descarga](https://www.docker.com/products/docker-desktop/)).
- Git (opcional, para clonar) o descargar el ZIP.
- 4 GB de RAM libres.
- Virtualización activada en la BIOS.

---

## 2. Poner en marcha

Abre **PowerShell** en la carpeta del proyecto:

```powershell
git clone https://github.com/4r4web/flota-tactica-v2.git
cd flota-tactica-v2

# Crea el entorno (copia y edita JWT_SECRET y POSTGRES_PASSWORD)
Copy-Item .env.prod.example .env.prod
notepad .env.prod

# Levanta el stack (PostgreSQL, Redis, servidor y web)
docker compose --env-file .env.prod -f docker/compose.tunnel.yml up -d --build

# Aplica las migraciones
docker compose --env-file .env.prod -f docker/compose.tunnel.yml run --rm server node dist/db/migrate.js
```

- Acceso local: **http://localhost:8080**
- Acceso en tu red: **http://\<IP-del-PC\>:8080** (obtén la IP con `ipconfig`).

> `JWT_SECRET` debe ser una cadena larga y aleatoria. Puedes generarla con:
> ```powershell
> -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
> ```

---

## 3. Abrir el puerto en el Firewall (para la red local)

Si quieres que otros dispositivos de tu red accedan por `http://<IP>:8080`, permite el puerto (ejecuta PowerShell **como administrador**):

```powershell
New-NetFirewallRule -DisplayName "Flota Tactica 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

Docker Desktop suele pedir permiso la primera vez; acéptalo.

---

## 4. Acceso desde fuera de la red (túnel)

Sin abrir puertos en el router:

```powershell
.\scripts\tunnel.ps1
```

El script descarga `cloudflared` automáticamente y muestra una URL tipo
`https://<aleatorio>.trycloudflare.com`. Compártela (o su QR). Es **HTTPS**, así que la PWA se instala en el móvil.

Si PowerShell bloquea la ejecución de scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\tunnel.ps1
```

---

## 5. Arranque automático

- **Docker Desktop** → *Settings* → activa **Start Docker Desktop when you sign in**.
- Los contenedores tienen `restart: unless-stopped`, así que se recuperan solos tras reiniciar el PC o Docker.
- Para el **túnel**, crea una tarea en el **Programador de tareas**:
  - Desencadenador: *Al iniciar sesión*.
  - Acción: *Iniciar un programa* → `powershell.exe`
  - Argumentos: `-ExecutionPolicy Bypass -File "C:\ruta\al\proyecto\scripts\tunnel.ps1"`

---

## 6. Comandos útiles (PowerShell)

| Acción | Comando |
|---|---|
| Ver estado | `docker compose --env-file .env.prod -f docker/compose.tunnel.yml ps` |
| Ver logs | `docker compose --env-file .env.prod -f docker/compose.tunnel.yml logs -f server` |
| Parar | `docker compose --env-file .env.prod -f docker/compose.tunnel.yml down` |
| Actualizar | `git pull` y repetir `up -d --build` + migración |
| Backup | `docker compose --env-file .env.prod -f docker/compose.tunnel.yml exec postgres pg_dump -U flota flota > backup.sql` |

---

## 7. Notas

- **Rendimiento:** cualquier PC moderno con 4 GB libres va sobrado para una beta por turnos.
- **Suspensión:** evita que el PC se suspenda (Configuración → Sistema → Inicio/apagado) mientras quieras la beta activa.
- **URL del túnel:** cambia al reiniciarlo. Para una URL fija, usa un túnel con nombre de Cloudflare (cuenta gratuita) + dominio.
- **Estado:** consulta `https://<url>/status`.
- **Recuerda:** sigue pendiente reemplazar `submarine.png` por la versión de 3 tramos.
