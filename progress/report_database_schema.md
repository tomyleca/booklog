# Reporte de Implementación: Feature #2 — Database Schema

## Resumen Ejecutivo
Se implementó exitosamente la Feature #2 ("database_schema") de BookLog. Se configuró Prisma ORM (v6.4.1) con SQLite como motor de persistencia relacional local, definiendo los modelos `Book` y `ReadingSession` con integridad referencial y eliminación en cascada. Se implementó una fábrica de cliente Prisma con resolución dinámica para Electron (`app.getPath('userData')`) y suites de prueba de integración aisladas en SQLite temporal que verifican todas las operaciones y restricciones.

---

## Archivos Creados y Modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `prisma/schema.prisma` | Esquema | Definición del proveedor SQLite, enum `BookStatus`, modelos `Book` y `ReadingSession`. |
| `prisma/migrations/20260930145056_init/migration.sql` | Migración SQL | Script SQL generado por Prisma Migrate con creación de tablas e índice único. |
| `src/shared/infrastructure/persistence/prismaClient.ts` | Código | Módulo con `resolveDatabaseUrl`, `createPrismaClient`, `getPrismaClient` y `disconnectPrismaClient`. |
| `tests/infrastructure/test_prisma_connection.test.ts` | Test | Suite de pruebas de integración con SQLite temporal en `os.tmpdir()` para CRUD, relaciones y cascada. |
| `docs/guides/prisma-sqlite-setup.md` | Documentación | Guía conceptual detallada con diagramas Mermaid de arquitectura, ciclo de vida en Electron y modelo ER. |
| `docs/decisions/002-database-schema.md` | Documentación | Registro de decisión arquitectónica (ADR-002) con contexto, decisiones y alternativas. |
| `src/preload/index.ts` | Ajuste | Corrección de directivas `@ts-ignore` a `@ts-expect-error` para cumplir con ESLint. |
| `package.json` | Configuración | Dependencias añadidas: `@prisma/client`, `prisma`, plugins `@typescript-eslint`. |

---

## Detalle Técnico del Esquema de Datos

### Modelo `Book`
- `id`: `Int` autoincremental (`@id @default(autoincrement())`).
- `googleBooksId`: `String?` opcional con restricción única (`@unique`).
- `title`: `String` obligatorio.
- `authors`: `String` serializado (formato JSON de lista de autores).
- `coverUrl`: `String?` opcional con URL a la portada.
- `pageCount`: `Int?` opcional.
- `isbn`: `String?` opcional.
- `status`: `BookStatus` enum (`TO_READ`, `READING`, `FINISHED`, `ABANDONED`) con valor por defecto `TO_READ`.
- `rating`: `Int?` opcional (validable 1-5 a nivel aplicación).
- `notes`: `String?` opcional para notas personales.
- `createdAt`: `DateTime` con valor por defecto `now()`.
- `updatedAt`: `DateTime` actualizado automáticamente con `@updatedAt`.
- `readingSessions`: Relación 1:N con `ReadingSession[]`.

### Modelo `ReadingSession`
- `id`: `Int` autoincremental (`@id @default(autoincrement())`).
- `bookId`: `Int` clave foránea vinculada a `Book.id`.
- `book`: Relación `@relation(fields: [bookId], references: [id], onDelete: Cascade)`.
- `startPage`: `Int` página de inicio.
- `endPage`: `Int?` página de término.
- `minutesRead`: `Int?` tiempo de lectura en minutos.
- `date`: `DateTime` fecha de la sesión.
- `createdAt`: `DateTime` con valor por defecto `now()`.

---

## Resolución Dinámica de Conexión en Electron

La función `resolveDatabaseUrl(customUrl?: string)` en `src/shared/infrastructure/persistence/prismaClient.ts` asegura:
1. **Inyección directa en tests**: Si se recibe `customUrl`, se prioriza de inmediato (permite bases temporales aisladas en `os.tmpdir()`).
2. **Variable de entorno**: Si `DATABASE_URL` está definida, se utiliza para compatibilidad con scripts o CI.
3. **Electron Runtime**: Si se ejecuta dentro de Electron (`process.versions.electron`), obtiene de forma segura la ruta mediante `app.getPath('userData')/booklog.db`, garantizando persistencia en el directorio de datos del usuario del SO sin escribir en `app.asar`.
4. **Fallback en desarrollo/Node**: Utiliza `./dev.db` como valor por defecto.

---

## Verificación y Calidad de Código

### 1. Pruebas Automatizadas (`pnpm test`)
```text
✓ tests/placeholder.test.ts (1 test) 3ms
✓ tests/infrastructure/test_prisma_connection.test.ts (6 tests) 998ms
  ✓ resolveDatabaseUrl > should prioritize explicitly passed customUrl
  ✓ resolveDatabaseUrl > should use DATABASE_URL env var if no custom url provided
  ✓ Database CRUD and relationships > should create a book, query it, and persist all fields correctly
  ✓ Database CRUD and relationships > should create reading sessions linked to a book and retrieve them
  ✓ Database CRUD and relationships > should enforce ON DELETE CASCADE when a book is deleted
  ✓ Database CRUD and relationships > should reject duplicate googleBooksId due to unique constraint

Test Files  2 passed (2)
     Tests  7 passed (7)
```

### 2. Comprobación de Tipos (`pnpm run typecheck`)
- `typecheck:node` (`tsc --noEmit -p tsconfig.node.json`): **0 errores**
- `typecheck:web` (`tsc --noEmit -p tsconfig.web.json`): **0 errores**

### 3. Compilación de Producción (`pnpm run build`)
- Compilación de bundles SSR para Main y Preload completada con éxito.
- Compilación de bundle de Renderer (React + Tailwind v4) completada con éxito (`out/renderer`).

### 4. Linter (`pnpm run lint`)
- ESLint ejecutado sobre todo el repositorio: **0 errores, 0 advertencias**.

---

## Cumplimiento de Reglas del Proyecto
- **Clean Architecture**: El esquema y el cliente residen estrictamente en la capa `infrastructure/persistence`. Ningún módulo de dominio o aplicación importa `@prisma/client`.
- **Imports locales con extensión `.js`**: Todos los imports relativos locales (ej. `from '../../src/shared/infrastructure/persistence/prismaClient.js'`) especifican `.js`. Los módulos externos (`@prisma/client`, `node:path`, etc.) no llevan extensión.
- **Protección de base de datos de usuario**: Las pruebas operan sobre bases SQLite generadas dinámicamente en `os.tmpdir()` y son limpiadas al finalizar.
- **TypeScript strict**: `noUncheckedIndexedAccess: true` y `strict: true` plenamente satisfechos sin `any` injustificado.
- **Sin emojis en comentarios de código**: Respetado en todos los archivos de implementación y pruebas.
- **feature_list.json**: Se preserva el estado asignado sin marcarlo como `done`.
