# Reporte de Implementación: Feature #7 - Capa IPC Main ↔ Renderer y Descarga Local de Portadas (`ipc_layer`)

## 1. Resumen Ejecutivo
Se implementó de manera completa la Feature #7 (`ipc_layer`), estableciendo una comunicación fuertemente tipada y segura entre el proceso principal (Main) y el proceso de interfaz (Renderer) en Electron, junto con la arquitectura Offline-First para descarga y visualización nativa de portadas locales.

Principales decisiones acordadas implementadas:
- **Patrón Result Estricto (`IpcResult<T>`):** Todas las invocaciones IPC devuelven `{ success: true, data: T }` o `{ success: false, error: string, code?: string }`, evitando excepciones no controladas a través del puente IPC y garantizando discriminación de tipos limpia en TypeScript.
- **Protocolo Seguro `booklog-media://`:** Registro privilegiado y handler de streaming nativo que sirve archivos locales directamente desde `app.getPath('userData')/covers` a elementos `<img src="booklog-media://covers/<uuid>.<ext>" />` sin cargar strings Base64 en memoria ni comprometer la seguridad (`path traversal` mitigado).
- **Bridge Seguro con `contextBridge`:** Exposición controlada en `window.api` segregada por módulos (`books`, `notes`, `covers`), impidiendo el acceso a APIs crudas de Node.js o `ipcRenderer` desde el Renderer.
- **Servicios de Consumo en Renderer:** Abstracciones de alto nivel (`bookService`, `noteService`, `coverService`) preparadas para la capa de interfaz React con resolución inteligente de URLs (`resolveCoverUrl`).

---

## 2. Modificaciones y Archivos Creados

### A. Contratos y Canales IPC (`src/shared/infrastructure/ipc/`)
- `channels.ts`: Constantes de canales fuertemente tipadas:
  - Libros: `books:list`, `books:getById`, `books:create`, `books:updateStatus`, `books:updateProgress`, `books:rate`, `books:delete`.
  - Notas: `notes:getByBook`, `notes:create`, `notes:update`, `notes:delete`.
  - Portadas: `covers:saveFromUrl`, `covers:saveFromLocal`.
- `contracts.ts`: Definición de `IpcResult<T>`, códigos de error tipados (`BOOK_NOT_FOUND`, `NOTE_NOT_FOUND`, `VALIDATION_ERROR`, `COVER_STORAGE_ERROR`, `INTERNAL_ERROR`), funciones auxiliares `ipcSuccess`, `ipcError`, formateador centralizado `formatIpcError`, y re-exportación de primitivos de dominio y DTOs.
- `index.ts`: Barrel export del módulo IPC compartido.

### B. Servicio de Portadas (`src/main/services/CoverStorageService.ts`)
- Gestión del directorio `covers` en `app.getPath('userData')` (con fallback dinámico para testing aislado).
- `saveFromUrl(url: string)`: Descarga de imagen mediante streaming `fetch`, validación de Content-Type/extensión, generación de UUID único y persistencia en disco, retornando la ruta relativa `covers/<uuid>.<ext>`.
- `saveFromLocalFile(sourcePath: string)`: Copia segura de archivo local al directorio de portadas.
- `getCoverFullPath(relativePath: string)`: Resolución y validación contra ataques de path traversal (`..`).

### C. Protocolo Seguro y Handlers en Main
- `src/main/protocol/mediaProtocol.ts`:
  - `registerMediaScheme()`: Registra el esquema `booklog-media` con privilegios `standard`, `secure`, `corsEnabled`, `supportFetchAPI`, `stream` antes de `app.whenReady()`.
  - `registerMediaProtocolHandler()`: Configura `protocol.handle('booklog-media', ...)` con `net.fetch(pathToFileURL)` y barrera estricta de directorio `userData`.
- `src/main/ipc/bookHandlers.ts`: Registra controladores IPC con `ipcMain.handle` para los 7 canales de libros orquestando los casos de uso (`ListBooks`, `GetBookById`, `AddBook`, `UpdateBookStatus`, `UpdateBookProgress`, `RateBook`, `DeleteBook`), devolviendo primitivos de dominio serializables y capturando excepciones.
- `src/main/ipc/noteHandlers.ts`: Registra controladores IPC para los 4 canales de notas orquestando `GetBookNotes`, `AddNote`, `UpdateNote` y `DeleteNote`.
- `src/main/ipc/coverHandlers.ts`: Registra controladores IPC para guardado de portadas delegando en `CoverStorageService`.
- `src/main/ipc/index.ts`: Punto único de registro `registerIpcHandlers(prisma, coverService)`.
- `src/main/index.ts`: Integración de `registerMediaScheme()`, `registerMediaProtocolHandler()`, inicialización de Prisma y desconexión segura en `app.on('before-quit')`.

### D. Preload Bridge (`src/preload/`)
- `src/preload/index.ts`: Implementación de `api` exponiendo las operaciones tipadas mediante `ipcRenderer.invoke` a través de `contextBridge.exposeInMainWorld('api', api)`.
- `src/preload/index.d.ts`: Extensión de la interfaz global `Window` con `api: BookLogApi`.

### E. Renderer Services (`src/renderer/src/services/`)
- `src/renderer/src/services/bookService.ts`: Cliente que consume `window.api.books`.
- `src/renderer/src/services/noteService.ts`: Cliente que consume `window.api.notes`.
- `src/renderer/src/services/coverService.ts`: Cliente para guardado de portadas y función helper `resolveCoverUrl` (maneja http, https, data:, booklog-media:// y rutas locales relativas).
- `src/renderer/src/services/index.ts`: Barrel export de los servicios del renderer.

### F. Pruebas Automatizadas (`tests/ipc/`)
- `tests/ipc/test_ipc_contracts.test.ts`:
  - 47 pruebas unitarias e integración simulada cubriendo:
    - Contratos `IpcResult` y formateador de errores `formatIpcError`.
    - Handlers de libros con `MockBookRepository` (éxito, validaciones, `BOOK_NOT_FOUND`, auto-finalización al 100%).
    - Handlers de notas con `MockBookRepository` y `MockNoteRepository` (éxito, `BOOK_NOT_FOUND`, `NOTE_NOT_FOUND`, validaciones).
    - `CoverStorageService` en directorio temporal aislado (copia local, descarga simulada con `fetch`, protección path traversal).
    - Handlers de portadas (`covers:saveFromUrl`, `covers:saveFromLocal`).
    - Helper `resolveCoverUrl` del Renderer con diversos formatos y fallbacks.

### G. Documentación Técnica
- `docs/decisions/007-ipc-layer.md`: ADR detallando la decisión de arquitectura IPC, patrón Result y protocolo `booklog-media://`.
- `docs/guides/electron-ipc-bridge.md`: Guía técnica con explicación detallada de arquitectura, límites de seguridad `contextBridge`, protocolos de streaming y diagramas Mermaid `sequenceDiagram`.
- `docs/guides/README.md`: Actualización del índice general de guías.

---

## 3. Verificación de Calidad

- **Tests Vitest (`pnpm test`):**
  - **10 suites ejecutadas, 139 tests pasados exitosamente** (0 fallas).
  - Incluye tests unitarios de dominio, infraestructura, persistencia SQLite, casos de uso de libros/notas y suite completa de contratos y handlers IPC.
- **Typecheck (`pnpm run typecheck`):**
  - `tsc --noEmit -p tsconfig.node.json` y `tsc --noEmit -p tsconfig.web.json` ejecutados sin errores (0 errores de tipado).
  - Extensión estricta `.js` en todos los imports locales relativos.
- **Linter (`pnpm run lint`):**
  - ESLint ejecutado sin advertencias ni errores (0 errores).
- **Build (`pnpm run build`):**
  - Compilación de `electron-vite build` (Main, Preload y Renderer) generada de forma limpia y exitosa.
