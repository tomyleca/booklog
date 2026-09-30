# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad. Los agentes revisores
> evalúan código contra este archivo. Si no está aquí, no es un requisito.

## Stack Tecnológico

| Capa             | Tecnología                             |
|------------------|----------------------------------------|
| Runtime          | Electron + electron-vite               |
| Lenguaje         | TypeScript strict                      |
| Frontend         | React 18+, Tailwind CSS v4, Lucide Icons |
| Base de datos    | SQLite vía Prisma ORM                  |
| API externa      | Google Books API (API Key configurable) |
| Testing          | Vitest                                 |
| State management | TanStack Query + Zustand               |
| Package manager  | pnpm                                   |

## Principios

1. **Clean Architecture con inversión de dependencias.** El dominio NO
   depende de infraestructura. Las capas externas dependen de las internas,
   nunca al revés. Las dependencias se inyectan, no se importan directamente.

2. **El frontend no sabe que existe SQLite.** El renderer consume servicios
   tipados expuestos por el preload bridge. Si se migrara a web, solo se
   cambiaría la implementación del servicio (HTTP en lugar de IPC).

3. **La lógica de negocio no sabe que existe Electron.** Los use cases
   reciben interfaces (ports), no implementaciones concretas. No importan
   nada de `electron`, `@prisma/client`, ni APIs de Node.

4. **Errores explícitos.** Las operaciones que pueden fallar lanzan
   excepciones tipadas del dominio, no devuelven `null` ni `undefined`.

5. **TypeScript strict en todo.** `strict: true`, `noUncheckedIndexedAccess: true`.
   No se permiten `any` explícitos salvo en boundaries con librerías externas
   (y deben estar documentados con un comentario).

## Estructura de carpetas

```
src/
├── main/                          # Proceso principal de Electron
│   ├── index.ts                   # Entry point, crea ventana
│   ├── ipc/                       # Handlers de IPC (registra canales)
│   │   ├── bookHandlers.ts
│   │   └── readingSessionHandlers.ts
│   └── services/                  # Wiring/DI del main process
│       └── container.ts           # Instanciación de repos, use cases
│
├── preload/                       # Preload script (contextBridge)
│   └── index.ts
│
├── renderer/                      # App React (Vite)
│   └── src/
│       ├── App.tsx
│       ├── pages/                 # Vistas principales
│       ├── components/            # Componentes reutilizables
│       ├── services/              # Clientes que consumen preload bridge
│       ├── hooks/                 # Custom hooks (queries, mutations)
│       └── stores/                # Zustand stores (si aplica)
│
├── shared/                        # Código compartido (sin deps de Electron ni React)
│   ├── domain/
│   │   ├── entities/              # Book.ts, ReadingSession.ts
│   │   ├── ports/                 # Interfaces de repositorio
│   │   └── errors/                # Excepciones del dominio
│   ├── application/
│   │   └── use-cases/             # Casos de uso
│   └── infrastructure/
│       ├── persistence/           # Implementaciones Prisma de los ports
│       │   └── mappers/           # Prisma model ↔ Domain entity
│       ├── api/                   # Google Books API client
│       └── ipc/                   # Definiciones de canales IPC (tipos compartidos)
│
tests/
├── domain/                        # Tests de entidades y value objects
├── application/                   # Tests de use cases (con mocks)
├── infrastructure/                # Tests de repos y APIs (con DB real temporal)
└── ipc/                           # Tests de contratos IPC
```

## Flujo de datos

```
Usuario → React Component → TanStack Query → Preload Bridge (contextBridge)
              ↓                                        ↓
          Zustand (UI state)                    IPC (ipcRenderer.invoke)
                                                       ↓
                                               Main Process Handler
                                                       ↓
                                               Use Case (application)
                                                       ↓
                                               Repository (port/interface)
                                                       ↓
                                               Prisma Repository (infra)
                                                       ↓
                                               SQLite (archivo local)
```

## Boundary IPC — El punto natural de desacoplamiento

La comunicación Main ↔ Renderer se hace exclusivamente vía `ipcMain.handle` /
`ipcRenderer.invoke` (patrón request-response). Los canales están definidos
como constantes tipadas en `src/shared/infrastructure/ipc/channels.ts`.

Si se migra a web en el futuro:
- Los handlers del main process se convierten en endpoints de una API REST.
- El preload bridge se reemplaza por un HTTP client con la misma interfaz.
- El dominio y los use cases no cambian.

## Qué NO hacer

- No importar `@prisma/client` ni `electron` desde `src/shared/domain/` ni `src/shared/application/`.
- No usar `any` sin un comentario que justifique por qué.
- No hardcodear la API key de Google Books en el código fuente.
- No poner lógica de negocio en los handlers de IPC — solo orquestan la llamada al use case.
- No usar `localStorage` ni `sessionStorage` para datos persistentes — toda persistencia va por SQLite.
- No usar `console.log` para debug en código commiteado.
