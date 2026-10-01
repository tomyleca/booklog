# ADR-013: Dashboard con Estadísticas y Hábitos de Lectura (`ui_dashboard_stats`)

## Estado
Aceptado

## Contexto
BookLog permite registrar y gestionar libros, su progreso de lectura y notas. Sin embargo, los lectores necesitan una vista analítica y agregada para comprender sus hábitos de lectura sin depender de servicios o llamadas externas:
1. Conocer cuántos libros han completado, cuántos tienen activos, pausados o por leer.
2. Cuantificar el volumen total de páginas leídas a lo largo de su biblioteca.
3. Observar visualmente la distribución porcentual de su catálogo según el estado de lectura.
4. Acceder rápidamente a los libros con actividad reciente para continuar leyendo o consultar sus notas.
5. Contar con una barra de navegación superior accesible que permita alternar entre la Biblioteca principal y el Dashboard en cualquier momento.

---

## Decisiones de Diseño y Arquitectura

### 1. Métricas / KPIs Clave y Algoritmo de Cálculo de Páginas
- **Decisión:**
  - Se calculan y exponen métricas destacadas:
    - Libros terminados (`FINISHED`).
    - Libros en lectura activa (`READING`).
    - Libros pausados (`PAUSED`).
    - Libros por leer (`TO_READ`) y abandonados (`ABANDONED`).
    - Total de libros en la biblioteca.
    - **Páginas totales leídas:** Se computa sumando las páginas leídas de cada libro bajo las siguientes reglas prioritarias:
      1. Si el estado del libro es `FINISHED` y tiene `pageCount > 0`, se suma la totalidad de `pageCount` (lectura completa).
      2. Si `currentPage` está definido y es `> 0`, se suma `currentPage`.
      3. Si `currentPage` no está definido (o es 0) pero dispone de `progressPercentage` y `pageCount`, se calcula `Math.round((progressPercentage / 100) * pageCount)`.
      4. En cualquier otro caso, se suma 0.
- **Razón:** Proporciona un cálculo fidedigno del esfuerzo lector tanto para libros con recuento exacto de páginas como para lecturas digitales basadas en porcentajes.

### 2. Desglose Visual por Estado de Lectura
- **Decisión:**
  - Se implementa una barra de distribución visual segmentada en proporción al total de libros, donde cada estado posee un código cromático Tailwind CSS sobrio y consistente con el resto de la aplicación:
    - `FINISHED`: Índigo (`bg-indigo-500`)
    - `READING`: Esmeralda (`bg-emerald-500`)
    - `PAUSED`: Ámbar (`bg-amber-500`)
    - `TO_READ`: Cielo (`bg-sky-500`)
    - `ABANDONED`: Rosa (`bg-rose-500`)
  - Tarjetas de resumen individual por estado con contador numérico y porcentaje redondeado.
- **Razón:** Permite visualizar de un vistazo la proporción de libros en curso frente a terminados o en lista de espera.

### 3. Lista de Libros Recientes
- **Decisión:**
  - Se muestran hasta 5 libros ordenados cronológicamente por `updatedAt` descendente (o `createdAt` como fallback).
  - Cada elemento incluye miniatura de portada (o placeholder neutro con Lucide `BookOpen`), título, autor, badge de estado, barra y porcentaje de progreso.
  - Al hacer clic o presionar Enter sobre un libro reciente, se navega a la vista de detalle correspondiente (`onSelectBook(book.id)`).
- **Razón:** Reduce la fricción para retomar lecturas en curso o consultar libros modificados recientemente.

### 4. Navegación Global en `App.tsx`
- **Decisión:**
  - Se expande el tipo de vista en `App.tsx`:
    ```typescript
    export type AppView =
      | { type: 'library' }
      | { type: 'dashboard' }
      | { type: 'detail'; bookId: number }
    ```
  - Se incorpora una barra de navegación superior (`<header>`) con el logo de BookLog y botones tipo tab para alternar entre "Biblioteca" y "Dashboard", con resaltado del estado activo.
  - Se almacena `previousView` (`'library'` o `'dashboard'`) para que, al regresar desde `BookDetailPage` mediante `onBack`, el usuario retorne contextualmente a la vista desde donde abrió el libro.
- **Razón:** Mantiene el enrutamiento simple, declarativo, predecible y sin dependencias externas pesadas de enrutamiento web.

---

## Consecuencias
- **Positivas:**
  - Visualización analítica rica y reactiva sin impacto en el rendimiento gracias a TanStack Query y memorización con `useMemo`.
  - Experiencia fluida de navegación entre Biblioteca, Dashboard y Detalle de Libro.
  - Compatibilidad total con los tests de integración existentes.
- **Mantenimiento:**
  - El helper `calculateBookPagesRead` y `sortRecentBooks` están desacoplados y probados de forma unitaria para facilitar futuras extensiones (ej. filtros temporales por mes o año).
