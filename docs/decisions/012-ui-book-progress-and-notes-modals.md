# ADR-012: Modales Reutilizables de Actualización de Progreso y Creación de Notas

## Estado
Aceptado

## Contexto
En la Feature #11 (`ui_book_detail`) se implementó la pantalla de detalle del libro con edición en línea directa del progreso y un modal básico integrado dentro del mismo archivo de la página.

Para la Feature #12 (`ui_book_progress_and_notes_modals`), era imperativo:
1. **Modularizar y desacoplar componentes:** Extraer tanto la actualización de progreso como la creación de notas a componentes reutilizables independientes (`UpdateProgressModal` y `AddNoteModal`) que puedan invocarse desde cualquier punto de la aplicación (detalle, biblioteca, dashboard).
2. **Selector de modo flexible para progreso:** Permitir a los usuarios ingresar su avance mediante páginas físicas o porcentaje, sincronizando ambos dinámicamente según el total de páginas.
3. **Sugerencia inteligente de finalización:** Detectar cuando el progreso llega al 100% o a la última página del libro para sugerir marcarlo como terminado (`FINISHED`), sin imponerlo rígidamente si el usuario decide desmarcarlo.
4. **Ergonomía superior en captura de notas:** Ofrecer atajos de teclado (`Ctrl + Enter` / `Cmd + Enter`) y validaciones claras en tiempo de ejecución.

---

## Decisiones de Diseño y Arquitectura

### 1. Extracción y Reutilización de Modales
- **Decisión:** Los modales se ubican en `src/renderer/src/components/UpdateProgressModal.tsx` y `src/renderer/src/components/AddNoteModal.tsx`, y se exportan en `src/renderer/src/components/index.ts`.
- **Razón:** Facilita la reutilización en futuras características (e.g. actualizar progreso directamente desde las tarjetas de la biblioteca o accesos rápidos de dashboard) sin duplicar lógica ni estado.

### 2. Soporte Dual: Modo "Por Página" vs "Por Porcentaje"
- **Decisión:**
  - Si el libro tiene `pageCount > 0`, se habilita por defecto el modo por página y se muestran las equivalencias dinámicas calculadas (`Math.round((página / pageCount) * 100)` y `Math.round((porcentaje / 100) * pageCount)`).
  - Si el libro no tiene `pageCount`, el componente inicia automáticamente en modo porcentaje y oculta etiquetas de conversión inaplicables.
- **Razón:** Adapta la experiencia tanto a libros impresos tradicionales como a libros electrónicos, audiolibros o documentos sin numeración de página formal.

### 3. Sugerencia Interactiva de Finalización con Opción de Desmarcado
- **Decisión:**
  - Al alcanzar el 100% o el total de páginas, se despliega un banner de felicitaciones con un checkbox: *"¿Marcar libro como terminado (FINISHED)?"*, activo por defecto (`true`).
  - Si el usuario conserva el checkbox marcado, se invoca `bookService.updateStatus(id, BookStatus.FINISHED)`.
  - Si el usuario lo desmarca explícitamente, se respeta su decisión manteniendo o restaurando su estado previo (e.g. `READING`), contrarrestando la auto-finalización del backend si correspondiera.
- **Razón:** Brinda una experiencia proactiva e inteligente sin restar control al usuario.

### 4. Atajo de Teclado `Ctrl + Enter` y Ergonomía en Notas
- **Decisión:**
  - En `AddNoteModal`, presionar `Ctrl + Enter` (o `Cmd + Enter` en macOS) envía el formulario inmediatamente.
  - El campo de texto recibe foco automático (`autoFocus`).
  - No se incluye número de página (conforme a la regla de producto: las notas son reflexiones globales/citas).
- **Razón:** Minimiza la fricción cognitiva para que anotar una idea sea tan instantáneo como escribirla y pulsar una tecla.

### 5. Flexibilidad en Servicios Frontend (`bookService` y `noteService`)
- **Decisión:** Enriquecer las firmas de métodos como `noteService.create` y `bookService.updateStatus` / `updateProgress` para aceptar tanto objetos DTO estructurados (`{ bookId, content }`) como argumentos posicionales (`bookId, content`).
- **Razón:** Reduce el acoplamiento y simplifica la legibilidad del código consumidor.

---

## Consecuencias y Verificación
- **Pruebas Automatizadas:** 21 nuevas pruebas unitarias y de integración en `tests/renderer/test_progress_and_notes_modals.test.ts`. El total del proyecto asciende a 258 pruebas pasando en verde (100% de éxito).
- **Control de Calidad:** Verificación completa con cero advertencias o errores en `pnpm run typecheck`, `pnpm run lint` y `pnpm run build`.
