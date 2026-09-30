# Verificación — Cómo demostrar que el trabajo funciona

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda feature termina con evidencia ejecutable, no con afirmaciones.

## Niveles de verificación

### Nivel 1 — Tests unitarios (obligatorio)

Toda función pública en `src/shared/` tiene al menos un test que:

1. Cubre el camino feliz.
2. Cubre al menos un camino de error si la función puede fallar.

Comando:
```bash
pnpm test
```

### Nivel 2 — Tests de integración (obligatorio para features de infraestructura)

Las features que tocan persistencia (Prisma), APIs externas (Google Books),
o IPC se verifican con tests de integración contra una base de datos SQLite
temporal (`:memory:` o archivo en `os.tmpdir()`):

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "file::memory:" } },
});

// ... test con datos reales
```

### Nivel 3 — Test visual / smoke test (obligatorio para features de UI)

Las features que agregan vistas o componentes se verifican ejecutando la app:

```bash
pnpm dev
```

Y comprobando visualmente que:
- El componente se renderiza sin errores en consola.
- La interacción funciona (clicks, forms, navegación).
- El layout responde a diferentes tamaños de ventana.

### Nivel 4 — Build de producción (al cerrar sesión)

Antes de cerrar, verificar que la app compila sin errores:

```bash
pnpm build
```

## Anti-patrones (no hacer)

- ❌ "He añadido el componente, debería funcionar." → falta test ejecutable.
- ❌ Test que solo verifica que la función no lanza excepción → tiene que
  comprobar el resultado concreto.
- ❌ Mockear Prisma en tests de infrastructure → usar base de datos real temporal.
- ❌ Marcar la feature como `done` sin pasar `pnpm test`.
- ❌ Importar implementaciones concretas en tests de application → usar mocks
  que implementen los ports.

## Verificación final antes de cerrar

```bash
pnpm test          # Todos los tests pasan
pnpm build         # Build sin errores de TypeScript
.\init.ps1         # Validación del harness
```

Si alguno está rojo, **no** marques nada como `done`. Anotá el bloqueo
en `progress/current.md` con estado `blocked` en `feature_list.json`.
