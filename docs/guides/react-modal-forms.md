# Guía Técnica: Formularios Modales y Mutaciones Asíncronas en BookLog

Esta guía detalla los patrones de diseño, accesibilidad, manejo de estado y persistencia recomendados para construir ventanas modales y formularios reactivos en la interfaz de BookLog.

---

## 1. Arquitectura de un Modal en BookLog

Los modales en BookLog siguen un enfoque de componente controlado y modular:
- El componente padre (ej. `LibraryPage`) es dueño del estado de apertura (`isAddModalOpen`).
- El modal (`AddBookModal`) recibe `isOpen`, `onClose` y opcionales slots de extensión (`renderSearchSlot`).
- Cuando `isOpen === false`, el modal devuelve `null` inmediatamente para evitar consumo de memoria y mantener el árbol DOM limpio.

```tsx
<AddBookModal
  isOpen={isAddModalOpen}
  onClose={() => setIsAddModalOpen(false)}
/>
```

---

## 2. Accesibilidad y Control de Eventos de Teclado

Para cumplir con estándares de accesibilidad (WCAG) y ergonomía de aplicación de escritorio:

1. **Atributos ARIA:**
   - Contenedor backdrop: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title-id"`.
   - Etiquetas de formulario asociadas mediante `htmlFor` y `id` unívocos.
2. **Cierre con tecla Escape:**
   ```tsx
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent): void => {
       if (e.key === 'Escape' && isOpen) {
         onClose()
       }
     }

     if (isOpen) {
       window.addEventListener('keydown', handleKeyDown)
     }

     return () => {
       window.removeEventListener('keydown', handleKeyDown)
     }
   }, [isOpen, onClose])
   ```
3. **Cierre por clic en el fondo (Backdrop):**
   ```tsx
   <div
     className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto"
     onClick={(e) => {
       if (e.target === e.currentTarget) {
         onClose()
       }
     }}
   >
     <div
       className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6"
       onClick={(e) => e.stopPropagation()}
     >
       {/* Contenido del modal */}
     </div>
   </div>
   ```

---

## 3. Manejo de Formularios y Validación en Cliente

1. **Campos con formato múltiple (Autores):**
   Para permitir que el usuario ingrese varios autores en un solo input de texto:
   ```ts
   const authorsList = authors
     .split(',')
     .map((a) => a.trim())
     .filter(Boolean)
   ```
   Si el campo se deja vacío, se provee un valor por defecto seguro (ej: `['Desconocido']`).

2. **Validaciones numéricas defensivas (Páginas):**
   ```ts
   if (pageCount.trim()) {
     const parsed = parseInt(pageCount.trim(), 10)
     if (Number.isNaN(parsed) || parsed <= 0) {
       setPageCountError('La cantidad de páginas debe ser un entero mayor a 0.')
     }
   }
   ```

3. **Limpieza y sincronización al reabrir:**
   Un efecto sincroniza o restablece el estado interno cada vez que `isOpen` pasa a `true` o cambian los `initialValues`.

---

## 4. Mutaciones Asíncronas con TanStack Query e IPC

En BookLog, la persistencia se realiza a través de `useMutation`:

```tsx
const queryClient = useQueryClient()

const mutation = useMutation({
  mutationFn: async () => {
    // 1. Descarga de imagen remota a almacenamiento local si aplica
    if (coverUrl.startsWith('http://') || coverUrl.startsWith('https://')) {
      const coverRes = await window.api.covers.saveFromUrl(coverUrl)
      if (coverRes.success) {
        coverPath = coverRes.data
      }
    }

    // 2. Creación del libro vía servicio IPC
    const res = await bookService.create({
      title,
      authors: authorsList,
      pageCount,
      isbn,
      status,
      coverUrl,
      coverPath
    })

    if (!res.success) {
      throw new Error(res.error || 'Error al guardar el libro')
    }

    return res.data
  },
  onSuccess: () => {
    // Invalida la query de libros para refrescar automáticamente la vista principal
    queryClient.invalidateQueries({ queryKey: ['books'] })
    onClose()
  },
  onError: (err: Error) => {
    setGeneralError(err.message)
  }
})
```

---

## 5. Prevención de Doble Envío y Feedback Visual

- El botón de confirmación se deshabilita cuando `mutation.isPending === true`.
- Se muestra un spinner de carga (`animate-spin`) y texto descriptivo ("Guardando...").
- Los errores son notificados de manera prominente mediante una caja de alerta con ícono `AlertCircle` (`data-testid="form-error-banner"`).

---

## 6. Preparación para Extensiones Futuras (Google Books API)

`AddBookModal` incluye un slot modular en la cabecera:
```tsx
{renderSearchSlot && (
  <div className="search-slot pb-2 border-b border-slate-800" data-testid="search-slot">
    {renderSearchSlot()}
  </div>
)}
```
Cuando la Feature #10 sea implementada, bastará con proporcionar el componente de búsqueda externa a través de esta prop o mediante composición directa, transfiriendo los metadatos obtenidos directamente a las propiedades del formulario.
