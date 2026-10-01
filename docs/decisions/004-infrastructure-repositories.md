# ADR-004: Implementación de Repositorios de Infraestructura con Prisma

## Estado
Aceptado

## Contexto
En la Feature #3 se definió la capa de dominio nuclear con las entidades ricas `Book` y `Note`, así como las interfaces de puerto `BookRepository` y `NoteRepository`.
Para materializar el almacenamiento de datos en la base de datos local SQLite administrada mediante Prisma ORM, se requiere implementar los adaptadores de infraestructura correspondientes, garantizando:
1. Desacoplamiento total entre las entidades de dominio y los modelos relacionales de Prisma.
2. Comportamiento predecible en consultas frecuentes (ordenamiento de libros y notas).
3. Eficiencia en la lectura, evitando la sobrecarga de consultas asociadas innecesarias.
4. Soporte para inyección de dependencias flexible en entornos de producción (Electron) y suites de prueba automatizadas.

---

## Decisiones

### 1. Inyección de Dependencias de `PrismaClient`
- `PrismaBookRepository` y `PrismaNoteRepository` reciben la instancia de `PrismaClient` a través de su constructor (`constructor(private readonly prisma: PrismaClient)`).
- Esto permite instanciar repositorios conectados al singleton principal en tiempo de ejecución de Electron o conectados a bases de datos SQLite temporales y aisladas durante las pruebas de integración.

### 2. Patrón Data Mapper (`BookMapper` y `NoteMapper`)
- Se implementaron mappers dedicados en `src/shared/infrastructure/persistence/mappers/`:
  - `BookMapper.toDomain(raw)` y `BookMapper.toPersistence(book)`.
  - `NoteMapper.toDomain(raw)` y `NoteMapper.toPersistence(note)`.
- **Serialización segura de autores:** SQLite no posee tipo nativo de array. Los autores se serializan a una cadena JSON (`JSON.stringify(string[])`) para persistencia, y se deserializan tolerantemente (soportando arrays JSON, strings planos heredados y fallbacks seguros sin provocar excepciones).

### 3. Carga Desacoplada de Notas
- Los métodos `findAll()`, `findById()` y `findByStatus()` de `PrismaBookRepository` devuelven la entidad `Book` con un arreglo de notas vacío (`notes: []`), sin realizar JOINs relacionales pesados.
- Las notas se obtienen de forma explícita mediante `PrismaNoteRepository.findByBookId(bookId)`, optimizando sustancialmente el rendimiento de las vistas de cuadrícula y biblioteca en la UI.

### 4. Políticas de Ordenamiento Predictivo
- **Libros:**
  - `findAll()` y `findByStatus()` ordenan de forma descendente por `updatedAt: 'desc'`. Los libros en curso o recientemente modificados se ubican prioritariamente al tope de las consultas.
- **Notas:**
  - `findByBookId()` ordena de forma cronológica ascendente `createdAt: 'asc'`, preservando el orden temporal en que el lector tomó sus apuntes.

### 5. Integridad Referencial y Eliminación en Cascada
- La eliminación de un libro a través de `PrismaBookRepository.delete(id)` delega la integridad referencial al motor SQLite mediante la restricción de clave foránea configurada con `ON DELETE CASCADE` (`PRAGMA foreign_keys = ON;`).
- Los métodos `delete` capturan de forma controlada el error `P2025` de Prisma (*Record to delete does not exist*), ofreciendo una semántica idempotente para evitar excepciones no deseadas en el ciclo de vida de la aplicación.

---

## Consecuencias

### Positivas
- **Aislamiento Arquitectónico:** La capa de dominio no conoce la existencia de Prisma, SQLite ni los esquemas relacionales.
- **Testabilidad:** La suite de pruebas de integración puede ejecutar pruebas concurrentes con bases de datos en memoria o temporales en `os.tmpdir()` sin riesgo de colisión o daño a los datos de desarrollo/usuario (`dev.db`).
- **Rendimiento:** Al no cargar notas en cada consulta de libros, se minimiza el tráfico de datos y la sobrecarga de instanciación en memoria.

### Neutrales
- Se requiere mantener actualizados los mappers si se agregan nuevos campos en las entidades o en el esquema de Prisma.
