# Guía Técnica: Vista de Detalle del Libro y Gestión de Notas

Esta guía describe la arquitectura, componentes y patrones implementados para la vista de detalle de libros (`BookDetailPage`) y la gestión de notas e ideas en BookLog.

---

## 1. Arquitectura General y Navegación

La interfaz de usuario de BookLog sigue un modelo de estado reactivo simple en `src/renderer/src/App.tsx`, eliminando la necesidad de routers basados en URLs de navegador innecesarios para una aplicación de escritorio local:

```typescript
export type AppView =
  | { type: 'library' }
  | { type: 'detail'; bookId: number }

export function App({ queryClient, initialView }: AppProps): JSX.Element {
  const [view, setView] = useState<AppView>(initialView ?? { type: 'library' })

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {view.type === 'library' ? (
          <LibraryPage onSelectBook={(bookId) => setView({ type: 'detail', bookId })} />
        ) : (
          <BookDetailPage
            bookId={view.bookId}
            onBack={() => setView({ type: 'library' })}
          />
        )}
      </div>
    </QueryClientProvider>
  )
}
```

### Flujo de Navegación:
1. En `LibraryPage`, al hacer clic sobre cualquier tarjeta de libro (`BookCard`), se dispara el callback `onSelectBook(book.id)`.
2. El estado en `App.tsx` cambia a `{ type: 'detail', bookId }`, montando `BookDetailPage`.
3. Al pulsar el botón `Volver a la Biblioteca` (`onBack`) o al eliminar el libro, el estado retorna a `{ type: 'library' }`.

---

## 2. Orquestación de Datos con TanStack Query

La página gestiona dos consultas asíncronas independientes utilizando las claves de caché `['book', bookId]` y `['notes', bookId]`:

```typescript
// Consulta del libro
const { data: book, isLoading: isBookLoading, isError: isBookError } = useQuery<BookPrimitives, Error>({
  queryKey: ['book', bookId],
  queryFn: async () => {
    const res = await bookService.getById(bookId)
    if (!res.success) throw new Error(res.error)
    return res.data
  }
})

// Consulta de notas
const { data: notes, isLoading: isNotesLoading, isError: isNotesError } = useQuery<NotePrimitives[], Error>({
  queryKey: ['notes', bookId],
  queryFn: async () => {
    const res = await noteService.getByBook(bookId)
    if (!res.success) throw new Error(res.error)
    return res.data
  }
})
```

---

## 3. Avance de Lectura: Edición Directa en Línea

El requerimiento acordado establece que la edición de páginas y porcentaje debe ocurrir en la misma pantalla sin modales:

### Sincronización Bidireccional:
- **Al editar página:** Si el libro tiene `pageCount`, el porcentaje se calcula como `Math.round((clampedPage / pageCount) * 100)`.
- **Al editar porcentaje:** Si el libro tiene `pageCount`, la página actual se calcula como `Math.round((clampedPct / 100) * pageCount)`.
- **Botón Guardar:** Se activa únicamente en estado "sucio" (`isProgressDirty`). Al presionar, ejecuta la mutación:

```typescript
const progressMutation = useMutation({
  mutationFn: async ({ page, percentage }: { page?: number; percentage?: number }) => {
    const res = await bookService.updateProgress({ id: bookId, page, percentage })
    if (!res.success) throw new Error(res.error)
    return res.data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['book', bookId] })
    queryClient.invalidateQueries({ queryKey: ['books'] })
    setIsProgressDirty(false)
    setProgressSuccessNotice(true)
  }
})
```

---

## 4. Estado de Lectura y Calificación Interactiva

### Selector de Estado:
El selector desplegable (`<select>`) ejecuta `updateStatus` tan pronto como el usuario cambia de opción:

```typescript
<select
  value={book.status}
  onChange={(e) => statusMutation.mutate(e.target.value as BookStatus)}
  data-testid="detail-status-select"
>
  <option value="TO_READ">Por leer</option>
  <option value="READING">Leyendo</option>
  <option value="PAUSED">Pausado</option>
  <option value="FINISHED">Terminado</option>
  <option value="ABANDONED">Abandonado</option>
</select>
```

### Sistema de Calificación con Estrellas:
Permite calificar de 1 a 5 estrellas con previsualización reactiva:
- **Hover:** Muestra temporalmente cuántas estrellas se asignarán (`hoveredRating`).
- **Click:** Asigna la calificación (`bookService.rate({ id, rating })`). Si se hace clic sobre la estrella que ya representa la calificación actual, se remueve (estableciendo `rating: null`).
- **Botón "Quitar":** Permite restablecer la calificación a sin calificar (`null`).

---

## 5. Gestión del Ciclo de Vida de Notas

1. **Listado Cronológico:** Las notas se ordenan en orden descendente por fecha de creación (`createdAt`), mostrando las reflexiones más recientes en la parte superior.
2. **Modal Compacto de Nueva Idea:**
   - Botón `+ Nueva Idea` despliega un modal con `textarea` autoenfocado.
   - Validación estricta que impide enviar cadenas vacías o compuestas sólo de espacios.
   - Al guardar exitosamente, invalida `['notes', bookId]` y cierra el modal.
3. **Eliminación Individual:** Cada tarjeta de nota incluye un botón con ícono de papelera que invoca `noteService.delete(noteId)`.

---

## 6. Eliminación de Libro y Confirmación

Para prevenir pérdida accidental de datos, el botón "Eliminar libro" despliega un modal con advertencia explícita:

```typescript
const deleteBookMutation = useMutation({
  mutationFn: async () => {
    const res = await bookService.delete(bookId)
    if (!res.success) throw new Error(res.error)
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['books'] })
    queryClient.removeQueries({ queryKey: ['book', bookId] })
    queryClient.removeQueries({ queryKey: ['notes', bookId] })
    setIsDeleteBookModalOpen(false)
    onBack()
  }
})
```

---

## 7. Estrategia de Pruebas Automatizadas

La suite `tests/renderer/test_book_detail_page.test.ts` utiliza `@testing-library/react` y mocks sobre `window.api` para evaluar:
- Renderizado de metadatos completos y estados vacíos/errores.
- Sincronización matemática bidireccional de página y porcentaje en tiempo real.
- Invocación correcta de mutaciones (`updateStatus`, `rate`, `updateProgress`, `delete`).
- Apertura, validación, envío y cierre del modal de notas.
- Eliminación de notas y libros con confirmación.
- Integración de navegación en el componente raíz `App`.
