# 02 — Ciclo de Vida de Desarrollo (SDLC)

Este documento define **cómo** se construye Flota Táctica v2: metodología, flujo de trabajo, calidad y definiciones de "terminado". La referencia de arquitectura está en `03-arquitectura.md` y el plan temporal en `06-roadmap.md`.

---

## 1. Metodología

**Kanban con sprints cortos de 1–2 semanas.** El objetivo es mantener un flujo continuo de trabajo con incrementos verificables, adaptándose a un equipo reducido.

### Principios

- **Entrega incremental:** cada fase produce algo desplegable y verificable.
- **Desarrollo guiado por pruebas** en el paquete de dominio (`@flota/domain`).
- **Trunk-based development:** ramas cortas, integración frecuente en `main`.
- **Automatización:** todo lo repetible se automatiza en CI (lint, tipos, tests, build).
- **Documentación viva:** las decisiones se registran como ADR; los cambios de contrato actualizan `05-protocolo.md`.

---

## 2. Tablero Kanban

Columnas y política de flujo:

| Columna | Significado | Límite WIP |
|---|---|---|
| **Backlog** | Ideas y trabajo no priorizado | — |
| **Ready** | Cumple la Definition of Ready; listo para empezar | — |
| **In Progress** | En desarrollo activo | 3 |
| **Review** | PR abierto, pendiente de revisión | 3 |
| **Testing** | Verificación funcional/integración | 2 |
| **Done** | Cumple la Definition of Done | — |

**Reglas:**
- No se empieza una tarjeta que no esté en **Ready**.
- Respetar los límites WIP: si una columna está llena, se ayuda a terminar antes de empezar algo nuevo.
- Cada tarjeta debe ser lo bastante pequeña para completarse en pocos días.

---

## 3. Flujo de trabajo con Git

### Ramas

- `main` es la rama de integración y siempre debe estar en verde (CI pasa).
- Ramas cortas con prefijo según el tipo: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`.
- Vida máxima recomendada de una rama: pocos días.

### Commits

Se sigue **Conventional Commits**:

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]

[footer opcional]
```

Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`.

Ejemplos:
```
feat(domain): add torpedo line attack with edge clipping
fix(server): reject actions outside the current turn
docs(protocol): document matchmaking messages
```

### Pull Requests

- Todo cambio llega a `main` mediante PR (salvo commits triviales de documentación).
- La PR debe pasar CI (lint, typecheck, tests, build) antes de fusionar.
- Requiere al menos **una revisión** (si el equipo lo permite).
- Se prefiere **squash merge** para mantener un historial limpio.
- La descripción de la PR referencia la tarjeta y describe el *qué* y el *porqué*.

---

## 4. Sprints

- Duración: **1–2 semanas**.
- Al inicio: se seleccionan tarjetas `Ready` desde el backlog priorizado.
- Durante: se actualiza el tablero a diario; se detectan bloqueos temprano.
- Al final: **demo** del incremento y **revisión** breve del flujo (qué fue bien, qué mejorar).
- No se compromete alcance no terminado; lo no completado vuelve al backlog priorizado.

---

## 5. Definiciones de calidad

### Definition of Ready (DoR)

Una tarjeta está lista para desarrollo cuando:

1. El objetivo y el valor están claros.
2. Tiene criterios de aceptación verificables.
3. Las dependencias están identificadas.
4. El alcance está acotado (cabe en pocos días).
5. Se conoce cómo se probará.

### Definition of Done (DoD)

Una tarjeta está terminada cuando:

1. El código está implementado y revisado.
2. Pasa **lint**, **typecheck** y **tests** en CI.
3. Se han añadido o actualizado las **pruebas** correspondientes.
4. La documentación afectada está actualizada (ADR, protocolo, README).
5. Se ha verificado el **criterio de aceptación**.
6. Está integrada en `main` y desplegada al menos en `staging` si aplica.

---

## 6. Estrategia de pruebas

| Nivel | Herramienta | Alcance |
|---|---|---|
| **Unitario** | Vitest | `@flota/domain` (portar tests del prototipo), `@flota/protocol` |
| **Integración** | Vitest + Testcontainers | API REST, WebSocket, repositorios con PostgreSQL y Redis reales |
| **End-to-End** | Playwright | Registro → sala → partida completa → revancha, en navegador real |
| **Carga** | k6 | Partidas concurrentes y latencia del WebSocket |

**Criterios:**
- Cobertura ≥ **80%** en `@flota/domain`.
- Toda regla del juego debe tener al menos una prueba unitaria.
- Todo endpoint REST y mensaje WebSocket debe tener prueba de integración.
- Los flujos críticos (auth, partida, reconexión) deben tener prueba E2E.

Detalle de casos en `06-roadmap.md` y en la especificación del juego.

---

## 7. Integración y entrega continuas (CI/CD)

**CI (en cada push y PR):**
1. Instalar dependencias (`pnpm install --frozen-lockfile`).
2. Lint (`oxlint`) y formato (`oxfmt --check`).
3. Typecheck (`tsc --noEmit`) en todos los paquetes.
4. Tests (unitarios + integración).
5. Build de servidor y cliente.

**CD (al fusionar en `main`):**
1. Construir imágenes Docker.
2. Publicar en el registro (GHCR).
3. Desplegar en `staging` automáticamente.
4. Desplegar en `production` tras validación manual.

---

## 8. Entornos

| Entorno | Uso | Datos |
|---|---|---|
| **Local** | Desarrollo diario | Docker Compose; datos de prueba |
| **Staging** | Validación previa a producción | Réplica reducida; datos sintéticos |
| **Production** | Usuarios reales | Datos reales; backups |

---

## 9. Gestión de la calidad y deuda técnica

- **Revisión de código** obligatoria antes de fusionar.
- **Refactorización continua:** la deuda técnica se registra como tarjeta y se prioriza.
- **Sin código muerto:** no se conserva código descartado del prototipo (p. ej. los componentes shadcn sin uso).
- **Seguridad desde el diseño:** validación estricta, principio de mínimo privilegio, secretos fuera del repositorio.

---

## 10. Roles (equipo reducido)

En un equipo pequeño los roles son flexibles:

| Rol | Responsabilidad |
|---|---|
| **Product Owner** | Prioriza el backlog, define criterios de aceptación. |
| **Desarrollo** | Implementa, prueba y revisa. |
| **Operación** | Despliegue, monitorización y respuesta a incidentes. |

Una misma persona puede asumir varios roles. Las decisiones técnicas relevantes se registran como ADR.

---

## 11. Estimación

- Se usa estimación relativa por **tallas** (XS, S, M, L) para evitar falsa precisión.
- Las tarjetas grandes (L) deben dividirse antes de entrar en `In Progress`.
- La velocidad se observa por flujo (tarjetas completadas por sprint), no como compromiso rígido.

---

## 12. Riesgos de proceso y mitigación

| Riesgo | Mitigación |
|---|---|
| Exceso de trabajo en curso | Límites WIP y foco en terminar antes de empezar |
| Reglas de dominio divergentes cliente/servidor | Paquete `@flota/domain` único y compartido (ADR-008) |
| Deuda por prototipo arrastrado | Reescritura limpia; no reutilizar código descartado |
| Despliegue manual propenso a errores | CI/CD automatizada y entornos reproducibles |
