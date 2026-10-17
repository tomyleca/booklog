# Configuración de Prisma y SQLite en Electron

> Guía conceptual para la integración y ciclo de vida de persistencia en BookLog utilizando Prisma ORM y SQLite en un entorno de escritorio con Electron y Clean Architecture.

---

## 1. Arquitectura de Persistencia y Clean Architecture

En BookLog, la persistencia de datos se concibe como un detalle de implementación ubicado en la capa de **Infraestructura** (`src/shared/infrastructure/persistence/`). Las reglas de negocio y los casos de uso (`src/shared/domain/` y `src/shared/application/`) no tienen conocimiento directo de Prisma ni de SQLite.

```mermaid
graph TD
    subgraph "Application Layer"
        UC[Casos de Uso]
    end

    subgraph "Domain Layer"
        Port["Port: BookRepository / NoteRepository (Interfaces)"]
    end

    subgraph "Infrastructure Layer"
        Repo["PrismaBookRepository (Implementación)"]
        ClientFactory["prismaClient.ts (getPrismaClient / resolveDatabaseUrl)"]
        PrismaORM["@prisma/client (PrismaClient)"]
        SQLiteFile[("booklog.db (SQLite en userData)")]
    end

    UC --> Port
    Repo -.->|Implementa| Port
    Repo --> ClientFactory
    ClientFactory --> PrismaORM
    PrismaORM --> SQLiteFile
```

---

## 2. Modelo Entidad-Relación (ER)

El esquema relacional define dos entidades principales: `Book` y `Note`, con integridad referencial y eliminación en cascada (`ON DELETE CASCADE`).

```mermaid
erDiagram
    Book ||--o{ Note : "tiene muchas (1:N, cascade)"

    Book {
        int id PK "autoincrement"
        string googleBooksId UK "nullable"
        string title
        string authors "JSON array serializado"
        string coverUrl "nullable"
        string coverPath "nullable, ruta local en caché"
        int pageCount "nullable"
        int currentPage "nullable"
        int progressPercentage "nullable, 0-100"
        string isbn "nullable"
        string status "TO_READ | READING | PAUSED | FINISHED | ABANDONED"
        int rating "nullable, validado 1-5"
        datetime createdAt "default now"
        datetime updatedAt "updatedAt"
    }

    Note {
        int id PK "autoincrement"
        int bookId FK "references Book.id"
        string content
        int page "nullable"
        datetime createdAt "default now"
        datetime updatedAt "updatedAt"
    }
```

### Características del Modelo:
- **`BookStatus`**: Emulado mediante enum en Prisma (`TO_READ`, `READING`, `PAUSED`, `FINISHED`, `ABANDONED`) con valor por defecto `TO_READ`.
- **`authors`**: Almacenado como texto serializado (ejemplo: formato JSON `["Autor A", "Autor B"]`) para simplificar la persistencia sin requerir tablas de unión N:M en una app monousuario local.
- **`googleBooksId`**: Índice único (`@unique`) que previene duplicados al importar metadatos desde la API de Google Books.
- **`coverPath`**: Ruta en el almacenamiento local (`userData/covers/`) que respalda la imagen de portada para un funcionamiento 100% offline-first.
- **`currentPage` y `progressPercentage`**: Permiten un seguimiento flexible del avance de la lectura, ya sea por número de página leído o por porcentaje directo (0-100).
- **`Note`**: Notas y reflexiones asociadas a un libro con referencia opcional a número de página (`page`). Al eliminar un libro, todas sus notas asociadas se eliminan en cascada automáticamente (`ON DELETE CASCADE`).

---

## 3. Ciclo de Vida de la Base de Datos en Electron

En una aplicación de escritorio, la base de datos SQLite no puede residir dentro del directorio del código empaquetado (e.g. `resources/app.asar`), ya que este es de sólo lectura una vez instalada la aplicación.

Por ende, el archivo de base de datos se almacena en el directorio `userData` que el sistema operativo asigna para la aplicación:
- **Windows**: `%APPDATA%\BookLog\booklog.db`
- **macOS**: `~/Library/Application Support/BookLog/booklog.db`
- **Linux**: `~/.config/BookLog/booklog.db`

### Resolución Dinámica de la Conexión

La función `resolveDatabaseUrl` en `src/shared/infrastructure/persistence/prismaClient.ts` aplica una jerarquía estricta:

```mermaid
flowchart TD
    Start([Llamada a resolveDatabaseUrl]) --> CheckCustom{¿Se proveyó customUrl?}
    CheckCustom -- Sí --> ReturnCustom[Usar customUrl]
    CheckCustom -- No --> CheckEnv{¿Existe process.env.DATABASE_URL?}
    CheckEnv -- Sí --> ReturnEnv[Usar variable de entorno]
    CheckEnv -- No --> CheckElectron{¿Ejecutando en Electron?<br/>process.versions.electron}
    CheckElectron -- Sí --> GetUserData["Obtener app.getPath('userData')"]
    GetUserData --> ReturnElectron["file:path/to/userData/booklog.db"]
    CheckElectron -- No --> ReturnDev["file:./dev.db (Fallback desarrollo/CLI)"]
```

---

## 4. Estrategia de Aislamiento para Tests

Para garantizar el cumplimiento de la regla de no alterar ni borrar jamás los datos reales del usuario ni bases de datos de desarrollo:

1. Los tests de infraestructura (`tests/infrastructure/test_prisma_connection.test.ts`) generan bases de datos temporales únicas en el directorio temporal del sistema operativo (`os.tmpdir()`).
2. Se instancia un `PrismaClient` apuntando exclusivamente a esa URL temporal (`file:${tempDbPath}`).
3. Se ejecutan dinámicamente y en orden todas las sentencias DDL de las migraciones existentes (`prisma/migrations/**/migration.sql`) y se activa `PRAGMA foreign_keys = ON;`.
4. Al finalizar la suite (`afterAll`), el cliente se desconecta y los archivos temporales (`.db` y `.db-journal`) se eliminan.

---

## 5. Comandos de Mantenimiento de Prisma

- Generar tipos del cliente:
  ```bash
  pnpm prisma generate
  ```
- Crear y aplicar nueva migración en desarrollo:
  ```bash
  pnpm prisma migrate dev --name <nombre_migracion>
  ```
- Inspeccionar la base de datos visualmente:
  ```bash
  pnpm prisma studio
  ```

---

## 6. Migraciones con backfill de datos (feature #20)

`prisma migrate dev` genera SQL a partir de la **diferencia de esquema**: sabe agregar una
columna, pero no sabe qué *valor* debería tener en las filas que ya existen. Si agregamos
`finishedAt DateTime?` a `Book`, todas las filas quedan con `NULL`, también los libros que
ya estaban terminados. Prisma **no hace backfill solo**: hay que escribirlo.

El flujo para una migración con datos es:

1. Cambiar `schema.prisma` (`finishedAt DateTime?`).
2. Generar la migración **sin aplicarla**:
   ```bash
   pnpm prisma migrate dev --create-only --name add_book_finished_at
   ```
3. Editar a mano `prisma/migrations/<timestamp>_add_book_finished_at/migration.sql` y
   agregar el `UPDATE` después del `ALTER TABLE`:
   ```sql
   ALTER TABLE "Book" ADD COLUMN "finishedAt" DATETIME;

   UPDATE "Book" SET "finishedAt" = "updatedAt"
   WHERE "status" = 'FINISHED' AND "finishedAt" IS NULL;
   ```
4. Aplicarla con el flujo normal (aplica las pendientes y regenera el cliente):
   ```bash
   pnpm prisma migrate dev
   ```

```mermaid
sequenceDiagram
    participant Dev as Desarrollador
    participant CLI as prisma migrate dev
    participant SQL as migration.sql
    participant DB as SQLite (dev.db)
    Dev->>CLI: --create-only --name add_book_finished_at
    CLI->>SQL: ALTER TABLE "Book" ADD COLUMN "finishedAt"
    Note over CLI,DB: Todavía no se tocó la base
    Dev->>SQL: agrega UPDATE ... SET finishedAt = updatedAt
    Dev->>CLI: prisma migrate dev
    CLI->>DB: ALTER TABLE + UPDATE (una sola vez)
    CLI->>DB: registra la migración en _prisma_migrations
    CLI->>CLI: prisma generate (cliente con finishedAt)
```

Puntos a tener en cuenta:

- **Editar antes de aplicar.** Prisma guarda un checksum de cada `migration.sql`
  aplicado; si se edita después, `migrate dev` detecta el cambio y propone resetear la
  base (borrando los datos). Por eso `--create-only`.
- **Idempotencia.** El `AND "finishedAt" IS NULL` hace que el `UPDATE` no pise nada si
  por algún motivo se ejecuta sobre datos que ya tienen fecha.
- **Copiar columnas en SQLite.** `SET "finishedAt" = "updatedAt"` copia el valor tal
  cual está guardado, en el mismo formato que Prisma usa para `DateTime`, así que el
  cliente lo lee sin conversiones.
- **Los tests ejecutan el mismo SQL.** Los tests de infraestructura aplican las
  migraciones partiendo el archivo por `;`. Por eso los comentarios del SQL no deben
  llevar `;`. El test `tests/infrastructure/test_finished_date_persistence.test.ts`
  aplica las migraciones anteriores, inserta libros "viejos", aplica la nueva y verifica
  que sólo los FINISHED quedaron con `finishedAt = updatedAt`.
- **Backfill en la migración vs. en código.** Hacerlo en la migración garantiza que corre
  una sola vez, en orden y versionado junto al cambio de esquema (ver ADR-020).
