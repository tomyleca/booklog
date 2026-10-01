# ADR-009: Formulario y Modal de Registro Manual de Libros (`AddBookModal`)

## Estado
Aceptado

## Contexto
La Feature #9 (`ui_add_book_manual`) requiere la creación de un formulario modal donde el usuario pueda cargar manualmente un libro a su biblioteca especificando título, autores, páginas, ISBN, estado inicial y una portada opcional (vía URL de internet o ruta local).

Además, el diseño del modal debe ser modular y extensible para que en la subsiguiente Feature #10 (`google_books_search`) sea posible incorporar directamente en la parte superior el buscador de Google Books API y autocompletar los campos sin necesidad de reescribir ni duplicar el componente del modal.

---

## Decisiones Adoptadas

### 1. Desacoplamiento y Slot Modular para Búsqueda Externa (Feature #10)
- **Decisión:** `AddBookModal` soporta la prop `renderSearchSlot?: () => React.ReactNode` y la prop `initialValues?: Partial<AddBookFormValues>`.
- **Razón:** Esto permite que la Feature #10 inyecte el buscador interactivo de Google Books en la cabecera del modal (`data-testid="search-slot"`) y pre-llene los campos del formulario cuando el usuario seleccione un resultado externo, manteniendo una separación de responsabilidades limpia entre la búsqueda externa y la persistencia local.

### 2. Procesamiento de Autores Múltiples como Arreglo Tipado
- **Decisión:** El campo de texto de autores permite escribir uno o varios autores separados por coma (ejemplo: `"Gabriel García Márquez, Mario Vargas Llosa"`). En el cliente se procesa dividiendo por comas, recortando espacios en blanco y descartando entradas vacías (`authors.split(',').map(s => s.trim()).filter(Boolean)`).
- **Razón:** Proporciona una interfaz de entrada simple y ergonómica para el usuario, a la vez que entrega un arreglo limpio `string[]` en el DTO de creación, alineado con las interfaces del dominio y de búsqueda (`BookSearchService`). Si el campo queda en blanco, el caso de uso asigna por defecto `['Desconocido']` para preservar los invariantes de la entidad `Book`.

### 3. Descarga Automática de Portadas Web a Almacenamiento Local
- **Decisión:** Si el usuario ingresa una URL web (`http://` o `https://`), el modal invoca el servicio IPC `window.api.covers.saveFromUrl(url)` antes o durante el guardado para descargar la imagen físicamente a la carpeta de datos de usuario de BookLog (`userData/covers/`) y asignar la ruta relativa correspondiente a `coverPath`.
- **Razón:** Asegura que la biblioteca sea completamente funcional y accesible sin conexión a internet (offline-first). Si la descarga fallara por problemas de red, se mantiene `coverUrl` como fallback sin interrumpir la creación del libro.

### 4. Mutación e Invalidación Reactiva con TanStack Query
- **Decisión:** Se utiliza el hook `useMutation` de `@tanstack/react-query`:
  - En `mutationFn`, se valida el formulario, se descarga la portada si corresponde y se ejecuta `bookService.create(...)`.
  - En `onSuccess`, se llama a `queryClient.invalidateQueries({ queryKey: ['books'] })` para que la vista de biblioteca (`LibraryPage`) refresque sus datos de forma automática e inmediata, y se cierra el modal.
  - En `onError`, se captura el mensaje de error y se presenta un banner visual destacado (`data-testid="form-error-banner"`).
- **Razón:** Consistencia arquitectónica con el patrón de cacheo y actualización reactiva utilizado en toda la capa de renderer.

### 5. Accesibilidad, Foco y Control de Cierre
- **Decisión:**
  - El modal se renderiza con `role="dialog"`, `aria-modal="true"` y `aria-labelledby="add-book-modal-title"`.
  - Se implementa cierre interactivo ante la pulsación de la tecla `Escape`, clic sobre el fondo oscuro (backdrop) y clic en el botón "Cancelar" o en la cruz superior ("X").
  - El botón de envío se desactiva y muestra un indicador de carga animado durante el proceso de guardado para prevenir dobles envíos accidentales.

---

## Consecuencias

### Positivas
- **Extensibilidad:** Listo para conectar el buscador de Google Books en la Feature #10 sin modificar la lógica interna del formulario manual.
- **Robustez:** Validación estricta en el cliente (título obligatorio, páginas enteras positivas) complementada con la validación de dominio en la entidad `Book`.
- **Persistencia offline:** Descarga automática de portadas remotas a disco local.
- **Testeabilidad:** Suite completa de 23 tests en Vitest cubriendo ciclo de vida, accesibilidad, validaciones, descarga de portadas, fallback de red e integración con `LibraryPage`.

### Mitigaciones
- **Fallos de red en portadas:** Se implementó manejo defensivo con `try/catch` para que un error en la descarga de imagen no bloquee la creación y persistencia del libro en SQLite.
