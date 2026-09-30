# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto está sano.

## C1 — El arnés está completo

- [ ] Existen los 4 archivos base: `AGENTS.md`, `init.ps1`, `feature_list.json`,
      `progress/current.md`.
- [ ] Existen los 3 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`.
- [ ] `.\init.ps1` termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests asociados que pasan.
- [ ] `progress/current.md` está vacío o describe la sesión activa
      (no contiene basura de sesiones anteriores).

## C3 — El código respeta la arquitectura

- [ ] La estructura de carpetas sigue lo definido en `docs/architecture.md`.
- [ ] `src/shared/domain/` no importa nada de `@prisma/client`, `electron`,
      ni ninguna dependencia de infraestructura.
- [ ] `src/shared/application/` solo importa de `src/shared/domain/`.
- [ ] Los use cases reciben dependencias por constructor (inyección), no
      importan implementaciones concretas.
- [ ] No hay `console.log` sueltos para debug, ni TODOs sin contexto.
- [ ] No hay `any` sin un comentario justificando el boundary.

## C4 — La verificación es real

- [ ] `tests/` tiene tests por capa: `domain/`, `application/`, `infrastructure/`.
- [ ] Los tests de infrastructure usan SQLite real temporal, no mocks de DB.
- [ ] `pnpm test` muestra > 0 tests y todos verdes.
- [ ] `pnpm build` compila sin errores de TypeScript.

## C5 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`*.tmp`, `node_modules` fuera
      del `.gitignore`).
- [ ] `progress/history.md` tiene una entrada por la última sesión.
- [ ] La última feature trabajada está reflejada en su estado correcto.

---

**Cómo usar este archivo:** un agente revisor recorre cada checkbox, marca
`[x]` o `[ ]`, y rechaza el cierre de sesión si quedan boxes vacíos en C1-C5.
