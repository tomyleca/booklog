# Convenciones de código

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece
> a sí mismo en todas partes.

## TypeScript

- **Versión:** TypeScript 5.x con `strict: true` y `noUncheckedIndexedAccess: true`.
- **Target:** ES2022 (para Electron, que usa Chromium reciente).
- **Formato:** Prettier con defaults. Líneas máximo 100 caracteres.
- **Linter:** ESLint con config recomendada para TypeScript.

## Imports

- **SIEMPRE** incluir la extensión `.js` en imports relativos de archivos locales.
- Imports de node_modules **SIN** extensión.
- Orden: 1) node_modules, 2) paths compartidos (`@shared/`), 3) relativos.
- Un import por línea.

```typescript
// node_modules
import { useState } from "react";

// shared (alias)
import { Book } from "@shared/domain/entities/Book.js";
import { BookRepository } from "@shared/domain/ports/BookRepository.js";

// relativos
import { BookCard } from "./components/BookCard.js";
```

## Nombres

| Tipo                    | Convención        | Ejemplo                    |
|-------------------------|-------------------|----------------------------|
| Archivos (componentes)  | `PascalCase`      | `BookCard.tsx`             |
| Archivos (utils/hooks)  | `camelCase`       | `useBooks.ts`              |
| Archivos (módulos)      | `camelCase`       | `bookHandlers.ts`          |
| Clases / Interfaces     | `PascalCase`      | `BookRepository`           |
| Funciones / variables   | `camelCase`       | `findById`                 |
| Constantes              | `UPPER_SNAKE`     | `IPC_CHANNELS`             |
| Tipos / Enums           | `PascalCase`      | `BookStatus`               |
| Componentes React       | `PascalCase`      | `LibraryPage`              |
| Hooks                   | `use` + PascalCase| `useBooks`                 |
| Directorios             | `kebab-case` o `camelCase` | `use-cases/`, `mappers/` |

## Estructura de archivos

Cada archivo en `src/shared/` empieza con un export claro. Una entidad, una
interfaz, o un use case por archivo. No mezclar.

```typescript
// src/shared/domain/entities/Book.ts
export interface BookProps {
  id?: number;
  title: string;
  // ...
}

export class Book {
  // ...
}
```

## Entidades de dominio

- Las entidades de dominio son **clases** con validación en el constructor.
- No usan decoradores de Prisma ni de ningún framework.
- Los value objects son `readonly` e inmutables.
- Los métodos de la entidad solo operan sobre sus propios datos.

## Interfaces (Ports)

- Todas las interfaces de repositorio van en `src/shared/domain/ports/`.
- Prefijo descriptivo, no genérico: `BookRepository`, no `IRepository<Book>`.
- Los métodos devuelven `Promise<T>` para permitir implementaciones async.

## Tests

- Un directorio de test por capa: `tests/domain/`, `tests/application/`, `tests/infrastructure/`.
- Archivos de test: `test_<cosa>.test.ts` (snake_case con sufijo `.test.ts`).
- Cada test describe su intención claramente: `it("should return empty array when no books exist")`.
- Tests de dominio: sin mocks, sin IO. Puros.
- Tests de application: mocks de los ports.
- Tests de infrastructure: base de datos SQLite real temporal (`:memory:` o archivo temporal).
- No usar snapshots salvo para UI y con justificación.

## Manejo de errores

Excepciones del dominio en `src/shared/domain/errors/`:

```typescript
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BookNotFoundError extends DomainError {
  constructor(id: number) {
    super(`Book with id ${id} not found`);
  }
}

export class InvalidRatingError extends DomainError {
  constructor(rating: number) {
    super(`Rating must be between 1 and 5, got ${rating}`);
  }
}
```

Los handlers de IPC capturan excepciones del dominio y devuelven errores
serializados al renderer. El renderer muestra feedback visual (toast).
Nunca se propagan stack traces al usuario.

## Comentarios

Por defecto **no** se escriben. Solo se permiten cuando explican un *por qué*
no obvio (p. ej. workaround documentado, invariante sutil, boundary con
librería externa). Los nombres deben hacer el resto.

## CSS / Estilos

**Fase actual: funcionalidad antes que estética.** El objetivo es un producto
funcional y usable. NO invertir tiempo en diseño visual elaborado, animaciones,
gradientes, ni pulido estético. Eso se hará en una fase posterior dedicada.

- Tailwind CSS v4 con las utilidades por defecto.
- Estilos básicos y limpios: layout correcto, tipografía legible, espaciado razonable.
- Dark mode como default, con toggle a light.
- No CSS modules ni styled-components. Solo Tailwind utilities.
- No animaciones, no gradientes, no glassmorphism — todavía.
- Colores del sistema de diseño definidos en `tailwind.config.ts` si se personalizan.
