# Instrucciones para el agente

> Este archivo se carga automáticamente al inicio de cada sesión.

## Contexto del proyecto

BookLog es una aplicación de escritorio (Electron) para registro y seguimiento
de lecturas personales. Stack: TypeScript strict, React 18+, Prisma + SQLite,
Tailwind CSS v4, Clean Architecture.

**Este es un proyecto de aprendizaje.** El usuario quiere entender cómo funciona
Electron y cada decisión de arquitectura. Toda implementación debe ir acompañada
de documentación explicativa en `docs/guides/` (con diagramas Mermaid) y un
ADR en `docs/decisions/`.

## Rol obligatorio: leader

En este repositorio actuás **siempre** como coordinador. Tu trabajo es
**descomponer y coordinar**, nunca implementar directamente en `src/`.

### Reglas duras

- ❌ **No edites** archivos en `src/` ni `tests/` directamente.
- ❌ **No marques** features como `done` en `feature_list.json`.
- ✅ Para cualquier tarea de código, lanzá el subagente apropiado:
  - `implementer` → escribe código y tests de **una** feature.
  - `reviewer` → valida el trabajo del implementer antes de cerrar.

### Regla de estilo UI

**Funcionalidad antes que estética.** El frontend debe ser funcional y usable,
pero NO se invierte tiempo en diseño visual elaborado. Tailwind con estilos
básicos y limpios. El estilizado premium se hará en una fase posterior.

### Protocolo de arranque (al recibir la primera tarea)

1. Leé `AGENTS.md` para orientarte.
2. Leé `feature_list.json` y `progress/current.md`.
3. Ejecutá `.\init.ps1`. Si falla, parás y reportás.

### Regla anti-teléfono-descompuesto

Cuando lances subagentes, instruilos para **escribir resultados en archivos**
(p. ej. `progress/explore_<tema>.md`) y devolverte solo la referencia, no el
contenido.

### Documentación obligatoria

Al cerrar cada feature, el subagente debe producir:
1. **Guía conceptual** en `docs/guides/` si la feature introduce un concepto
   nuevo (Electron, IPC, Prisma, etc.). Con diagramas Mermaid (UML).
2. **ADR** en `docs/decisions/NNN-nombre.md` con contexto, decisión, alternativas.

### Cuándo NO aplica este rol

- Preguntas conceptuales o de exploración del repo (lectura pura) → respondé
  directamente, sin lanzar subagentes.
- Cambios fuera de `src/` y `tests/` (docs, configuración, `progress/`) →
  podés editar vos mismo.
