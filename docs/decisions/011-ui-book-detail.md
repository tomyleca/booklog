# ADR-011: Vista de Detalle del Libro, Edición de Progreso en Línea y Gestión de Notas

## Estado
Aceptado

## Contexto
La Feature #11 (`ui_book_detail`) introduce la vista de detalle en profundidad de un libro seleccionado y la gestión completa de sus notas e ideas de lectura asociadas.

Para consolidar la experiencia del usuario y cumplir los requerimientos de diseño acordados:
1. **Navegación contextual:** El usuario debe poder saltar sin fricción desde cualquier tarjeta de libro en la biblioteca (`LibraryPage`) a la vista de detalle completa (`BookDetailPage`), y regresar en cualquier momento conservando el estado.
2. **Edición directa en línea de progreso:** A diferencia de flujos rígidos con modales para cada cambio menor, el usuario solicitó poder editar directamente el avance de lectura (página actual o porcentaje) junto a la barra visual en la misma pantalla.
3. **Control total de estado y calificación:** Actualizar de forma ágil el estado del libro (`TO_READ`, `READING`, `PAUSED`, `FINISHED`, `ABANDONED`) y calificar de 1 a 5 estrellas con previsualización interactiva (hover y click).
4. **Captura y gestión de notas/reflexiones:** Una bitácora cronológica donde añadir citas, ideas o reflexiones mediante un modal compacto y eliminar notas que ya no sean necesarias.
5. **Eliminación segura del libro:** Un mecanismo para remover el libro de la biblioteca que prevenga borrados accidentales mediante confirmación explícita, advirtiendo sobre la eliminación en cascada de sus notas asociadas.

---

## Decisiones de Diseño Acordadas con el Usuario

### 1. Gestión de Notas e Ideas
- **Decisión:** 
  - Listado de notas en tarjetas ordenadas cronológicamente (las más recientes arriba).
  - Cada tarjeta presenta el texto completo con saltos de línea preservados (`whitespace-pre-wrap`), la fecha/hora formateada y un botón de eliminación individual con confirmación implícita por mutación directa.
  - Botón destacado "+ Nueva Idea" que despliega un modal compacto con foco automático en el campo de texto.
  - Validación obligatoria: no se permite registrar notas vacías o compuestas únicamente de espacios en blanco.
- **Razón:** Maximiza la utilidad como diario de lectura y bitácora intelectual, reduciendo la fricción para anotar una reflexión mientras se lee.

### 2. Avance de Lectura: Edición Directa en Línea con Sincronización Bidireccional
- **Decisión:** 
  - La barra de progreso visual está acompañada por dos inputs numéricos directos: página actual y porcentaje de avance.
  - Al modificar la página, se calcula y actualiza automáticamente el porcentaje proporcional respecto al total de páginas del libro (`Math.round((página / total) * 100)`).
  - Al modificar el porcentaje, se calcula y actualiza la página equivalente (`Math.round((porcentaje / 100) * total)`).
  - El botón "Guardar progreso" permanece deshabilitado hasta que el usuario realiza cambios (dirty state), y al guardarse invoca `bookService.updateProgress` con retroalimentación visual de confirmación.
- **Razón:** Ofrece máxima flexibilidad: permite registrar el avance tanto a quien lleva la cuenta por páginas como a quien lee en dispositivos electrónicos midiendo porcentajes.

### 3. Estado de Lectura y Calificación Interactiva
- **Decisión:**
  - Selector desplegable (`<select>`) con etiquetas legibles en español. Cada cambio de opción ejecuta inmediatamente `bookService.updateStatus`.
  - Componente de 5 estrellas con interacción dual: efecto hover para previsualizar la puntuación y clic para fijar la calificación via `bookService.rate`.
  - Si el usuario pulsa sobre la misma estrella ya calificada o presiona el botón "Quitar", la calificación se remueve pasando `null`.
- **Razón:** Proporciona retroalimentación táctil inmediata y consistente con aplicaciones de catálogo modernas.

### 4. Eliminación Segura con Modal de Confirmación
- **Decisión:**
  - Botón "Eliminar libro" en tonos rojizos sobrios en la barra superior.
  - Al presionarlo, abre un modal de advertencia con el mensaje: *"¿Estás seguro de que deseas eliminar este libro? Se eliminarán también todas sus notas."*
  - Al confirmar, ejecuta `bookService.delete(id)`, limpia la caché de queries relacionadas y navega automáticamente de regreso a la biblioteca.
- **Razón:** Previene pérdidas de información involuntarias garantizando la integridad relacional configurada en Prisma (`onDelete: Cascade`).

### 5. Navegación Basada en Estado Reactivo
- **Decisión:**
  - En `App.tsx`, el enrutamiento se maneja mediante un estado discriminado simple: `AppView = { type: 'library' } | { type: 'detail', bookId: number }`.
  - En `LibraryPage`: la prop `onSelectBook?: (bookId: number) => void` se delega al hacer clic en cualquier `BookCard`.
  - En `BookDetailPage`: botón visible superior `< Volver a la Biblioteca` (`onBack`) que restablece la vista a `{ type: 'library' }`.
- **Razón:** En una aplicación de escritorio local con vistas enfocadas, prescindir de routers pesados externos como `react-router-dom` mantiene la arquitectura ligera, predecible y 100% testeable sin capas de abstracción innecesarias.

---

## Decisiones Técnicas y de Arquitectura

1. **Gestión de Estado Asíncrono con TanStack Query:**
   - Query clave para libro: `['book', bookId]`.
   - Query clave para notas: `['notes', bookId]`.
   - Mutaciones reactivas con invalidación coordinada (`queryClient.invalidateQueries({ queryKey: ['books'] })`, `['book', bookId]` y `['notes', bookId]`), manteniendo la biblioteca sincronizada automáticamente cuando el usuario regresa.
2. **Compatibilidad Estricta de Imports ESM:**
   - Todos los imports de módulos y contratos locales relativos incorporan la extensión explícita `.js` para cumplir con las directrices de empaquetado ESM y Node/Vite.

---

## Consecuencias

### Positivas
- Experiencia de usuario coherente y fluida para la inspección y edición de libros individuales.
- Flujo de notas robusto y aislado que promueve el registro activo de aprendizajes.
- 100% de cobertura de pruebas unitarias y de integración para todos los flujos de detalle, mutaciones y navegación.
