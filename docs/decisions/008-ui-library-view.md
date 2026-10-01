# ADR-008: Vista de Biblioteca, Estado con TanStack Query y Diseño Minimalista de Tarjetas

## Estado
Aceptado

## Contexto
La Feature #8 (`ui_library_view`) representa la vista principal de la aplicación BookLog: la visualización y filtrado de la colección de libros del usuario.

En una arquitectura Electron moderna:
1. **Consumo asíncrono sobre IPC:** Aunque no existe una API REST remota, las llamadas al proceso principal (`window.api.books.list`) son asíncronas y están sujetas a latencia de disco/base de datos y posibles errores en canal IPC. Se requería una solución estándar para manejar estados de carga (`isLoading`), fallas (`isError`), refrescos en segundo plano y cacheo local sin reinventar código repetitivo de `useEffect` y flags de estado manuales.
2. **Filtrado por estado de lectura:** El usuario debe poder alternar rápidamente entre ver todos los libros o filtrar por estados específicos (`TO_READ`, `READING`, `PAUSED`, `FINISHED`, `ABANDONED`).
3. **Claridad y funcionalidad en la visualización:** En la reunión de diseño con el usuario se definieron pautas claras para priorizar la legibilidad y simplicidad operativa sobre adornos visuales superfluos.

---

## Decisiones de Diseño Acordadas

### 1. Avance de Lectura en Tarjetas: Solo Porcentaje
- **Decisión:** Para libros en estados con avance activo (`READING`, `PAUSED`, `ABANDONED`), la tarjeta muestra una barra de progreso visual limpia acompañada únicamente del valor porcentual (ej: `65%`).
- **Razón:** Evita saturar la vista de cuadrícula con texto redundante ("página X de Y", etc.) permitiendo un escaneo visual rápido. Los estados sin avance (`TO_READ` y `FINISHED`) no muestran la barra de progreso, manteniendo la tarjeta despejada.

### 2. Placeholder Neutro para Libros sin Portada
- **Decisión:** Cuando un libro no cuenta con imagen de portada (`coverPath` o `coverUrl` vacíos), o cuando la imagen no puede cargarse (evento `onError` en `<img>`), se renderiza un contenedor neutro simple únicamente con el ícono `BookOpen` de Lucide.
- **Razón:** Mantiene coherencia estética y neutralidad sin inventar patrones visuales invasivos ni tipografías gigantescas sobre fondos estridentes.

### 3. Estilo: Funcionalidad antes que Estética con Tailwind CSS v4
- **Decisión:** Utilizar Tailwind CSS v4 con una paleta sobria basada en grises oscuros e índigo (`slate-900`, `slate-800`, `slate-700`, acentos `indigo-600`), soporte nativo para dark mode, tipografía legible y diseño responsive (1 columna en móvil, 2 en pantallas medianas, 3 a 4 en pantallas amplias).
- **Razón:** La interfaz debe ser una herramienta de trabajo y registro veloz, no una distracción.

---

## Decisiones de Arquitectura de Software

### 4. Orquestación de Estado con TanStack Query (`@tanstack/react-query`)
- Se configuró `QueryClient` en `src/renderer/src/App.tsx` con opciones por defecto seguras para aplicaciones de escritorio locales:
  - `retry: false`: Las fallas en IPC/SQLite local no son problemas intermitentes de red que se solucionen reintentando a ciegas.
  - `refetchOnWindowFocus: false`: Evita reconsultas innecesarias al cambiar de foco en la ventana del sistema operativo.
  - `staleTime: 5 min`: Mantiene los datos frescos en memoria evitando refetches redundantes durante la navegación.
- En `LibraryPage`, se utiliza la query `['books', selectedStatus]`:
  - `selectedStatus === 'ALL'` delega en `bookService.list(undefined)`.
  - `selectedStatus !== 'ALL'` delega en `bookService.list({ status: selectedStatus })`.
  - El resultado encapsulado en `IpcResult<T>` se desenvuelve: si `success === false`, se lanza una excepción capturada automáticamente por `useQuery`.

### 5. Estructura y Modularidad de Componentes
Se definieron componentes atómicos y reutilizables en `src/renderer/src/components/`:
- `StatusFilterTabs`: Pestañas accesibles (`role="tab"`, `aria-selected`) para alternar filtros de estado con indicadores visuales claros.
- `BookCard`: Tarjeta individual de libro con resolución de portada offline (`resolveCoverUrl`), badge de estado coloreado, rating de 5 estrellas y barra de porcentaje.
- `BookGrid`: Grid responsive con Tailwind (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`).
- `EmptyLibraryState`: Mensaje explicativo cuando la colección está vacía o el filtro no produce coincidencias, incluyendo acción para restablecer el filtro.
- `LibraryPage`: Página contenedora en `src/renderer/src/pages/` que une la orquestación asíncrona, el encabezado, filtros y los estados de UI (loading, error, lista vacía, lista con datos).

---

## Consecuencias

### Positivas
- **Mantenibilidad:** Separación nítida entre lógica de datos (React Query + IPC service) y presentación (componentes puros).
- **Experiencia de usuario fluida:** Estados de carga y error tratados como ciudadanos de primera clase con botón de reintento interactivo.
- **Testeabilidad:** La capa de presentación se prueba en un entorno simulado (`jsdom` + `@testing-library/react`) sin necesidad de levantar Electron ni SQLite real, mockeando únicamente `bookService`.

### Mitigaciones
- **Entorno de pruebas React:** Se configuró Vitest con `@vitejs/plugin-react` y directivas `@vitest-environment jsdom` por suite de pruebas, garantizando que el resto de tests de backend y dominio sigan ejecutándose en Node.js de alta velocidad.
