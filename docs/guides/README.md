# Guías de aprendizaje

> Este directorio contiene guías conceptuales que explican **por qué** se toman
> ciertas decisiones y **cómo** funciona cada pieza del stack. Incluyen
> diagramas UML (Mermaid) para visualizar la arquitectura.

## Índice

| Guía | Tema | Se escribe con feature |
|------|------|----------------------|
| `electron-fundamentals.md` | Main process, renderer, preload, IPC | Feature 1 (scaffolding) |
| `clean-architecture.md` | Capas, inversión de dependencias, ports & adapters | Feature 3 (domain entities) |
| `ipc-bridge.md` | Comunicación tipada main ↔ renderer | Feature 7 (IPC layer) |
| `prisma-sqlite.md` | Prisma en Electron, migraciones, path dinámico | Feature 2 (database schema) |
| `react-state-management.md` | TanStack Query + Zustand en el renderer | Feature 8 (UI biblioteca) |

Las guías se crean conforme se implementan las features relacionadas, no antes.
