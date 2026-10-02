# Guías de aprendizaje

> Este directorio contiene guías conceptuales que explican **por qué** se toman
> ciertas decisiones y **cómo** funciona cada pieza del stack. Incluyen
> diagramas UML (Mermaid) para visualizar la arquitectura.

## Índice

| Guía | Tema | Se escribe con feature |
|------|------|----------------------|
| `electron-fundamentals.md` | Main process, renderer, preload, IPC | Feature 1 (scaffolding) |
| `clean-architecture-domain.md` | Capas, entidades, invariantes, ports & adapters | Feature 3 (domain entities) |
| `clean-architecture-use-cases.md` | Capa de aplicación, casos de uso, DTOs y orquestación | Feature 5 (use cases books) |
| `notes-use-cases.md` | Casos de uso de notas, modelo de reflexiones y validación | Feature 6 (use cases notes) |
| `electron-ipc-bridge.md` | Comunicación tipada main ↔ renderer, protocolo custom y patrón Result | Feature 7 (IPC layer) |
| `prisma-sqlite.md` | Prisma en Electron, migraciones, path dinámico | Feature 2 (database schema) |
| `react-query-tailwind-library.md` | TanStack Query, Tailwind CSS v4 e IPC en la vista de biblioteca | Feature 8 (UI biblioteca) |
| `react-modal-forms.md` | Formularios modales, validación, accesibilidad e invalidación reactiva | Feature 9 (UI agregar libro manual) |
| `external-api-integration.md` | Búsqueda en Google Books, sanitización, debounce y persistencia offline | Feature 10 (Google Books search) |
| `react-book-detail-view.md` | Vista de detalle de libro, edición de progreso en línea y bitácora de notas | Feature 11 (UI detalle del libro y notas) |
| `app-settings-persistence.md` | Persistencia de preferencias, cifrado safeStorage y selector de tema reactivo | Feature 15 (settings page) |

Las guías se crean conforme se implementan las features relacionadas, no antes.

