# AGENTS.md — Mapa de navegación para agentes de IA

> Este archivo es el **punto de entrada** para cualquier agente que trabaje en este
> repositorio. NO es una biblia de reglas: es un **mapa**. Lee solo lo que
> necesites cuando lo necesites (divulgación progresiva).

---

## 1. Antes de empezar (obligatorio)

1. Ejecuta `.\init.ps1` y verifica que termina sin errores. Si falla, **para**
   y resuelve el entorno antes de tocar código.
2. Lee `progress/current.md` para entender en qué estado quedó la última sesión.
3. Lee `feature_list.json` y elige **una** tarea con estado `pending`. No
   trabajes en más de una a la vez.

## 2. Mapa del repositorio

| Archivo / carpeta            | Qué contiene                                              | Cuándo leerlo |
|------------------------------|-----------------------------------------------------------|---------------|
| `feature_list.json`          | Lista de tareas con estado (pending / in_progress / done) | Siempre, al empezar |
| `progress/current.md`        | Estado de la sesión actual                                | Siempre, al empezar |
| `progress/history.md`        | Bitácora append-only de sesiones anteriores               | Si necesitas contexto histórico |
| `docs/architecture.md`       | Stack, estructura de carpetas, flujo de datos, reglas     | Antes de implementar |
| `docs/conventions.md`        | Reglas de estilo, nombres, imports, testing               | Antes de escribir código |
| `docs/verification.md`       | Cómo verificar que tu trabajo funciona                    | Antes de declarar una tarea como `done` |
| `docs/guides/`               | Guías conceptuales con diagramas UML (Mermaid)            | Para aprender cómo funciona cada pieza |
| `docs/decisions/`            | ADRs: decisiones de arquitectura por feature              | Al cerrar una feature |
| `CHECKPOINTS.md`             | Criterios objetivos de "estado final correcto"            | Para auto-evaluarte |
| `src/`                       | Código de la aplicación (Electron + React)                | Para implementar |
| `tests/`                     | Tests automáticos (Vitest)                                | Para verificar |

## 3. Reglas duras (no negociables)

- **Una sola feature a la vez.** No mezcles cambios de varias tareas en la misma sesión.
- **No declares una tarea `done` sin pruebas verdes.** Ejecuta `pnpm test` y
  asegúrate de que todos los tests pasan.
- **Documenta lo que haces** en `progress/current.md` mientras trabajas, no al final.
- **Deja el repositorio limpio** antes de cerrar la sesión (ver §5).
- **Si no sabes algo, busca en `docs/`** antes de inventarlo.
- **Funcionalidad antes que estética.** El frontend debe ser funcional y usable,
  pero NO invertir tiempo en diseño visual elaborado. Estilizado premium se
  hará en una fase posterior. Tailwind con estilos básicos y limpios es suficiente.

## 4. Documentación obligatoria por feature

Al implementar una feature, el agente **debe** producir:

1. **Guía conceptual** en `docs/guides/` (si la feature introduce un concepto
   nuevo del stack: Electron, IPC, Prisma, etc.). Incluir diagramas Mermaid
   (secuencia, clases, componentes) que expliquen cómo funciona.
2. **ADR** en `docs/decisions/NNN-nombre.md` con contexto, decisión, y
   alternativas descartadas.
3. **Comentarios en código** solo cuando explican un *por qué* no obvio.

Este es un proyecto de aprendizaje. La documentación es tan importante como el código.

## 5. Cómo elegir una tarea

```
1. Abre feature_list.json
2. Filtra por status == "pending"
3. Coge la de menor "id"
4. Cambia su status a "in_progress" y guarda
5. Anota en progress/current.md: feature, hora de inicio, plan breve
```

## 6. Cierre de sesión (lifecycle)

Antes de terminar:

1. Ejecuta `pnpm test` — todo verde.
2. Si la tarea está acabada: marca `status: "done"` en `feature_list.json`.
3. Mueve el resumen de `progress/current.md` al final de `progress/history.md`.
4. Vacía `progress/current.md` dejando solo la plantilla.
5. No dejes archivos temporales, ni `console.log` de debug, ni TODOs sin contexto.

## 7. Si te bloqueas

- Relee la sección relevante de `docs/`.
- Si la herramienta no hace lo que esperas, **no inventes un workaround**:
  documenta el bloqueo en `progress/current.md` y para la sesión.
