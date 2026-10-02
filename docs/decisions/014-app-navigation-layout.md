# ADR-014: Layout Principal, Navegación y Titlebar Personalizada (`app_navigation_layout`)

## Estado
Aceptado

## Contexto
BookLog ha alcanzado una madurez funcional destacada incorporando biblioteca, catálogo, detalle de libro, notas, modal de progreso y dashboard de estadísticas. Para consolidar una experiencia de usuario de escritorio de primer nivel y preparar la aplicación para futuras opciones de configuración (Feature #15), se requiere:
1. Una ventana frameless sin marco estándar del sistema operativo para una integración estética unificada con Tailwind CSS en tema oscuro.
2. Controles de ventana propios en el proceso renderer (minimizar, maximizar/restaurar y cerrar) comunicados vía IPC seguro con el proceso Main de Electron.
3. Un menú lateral accesible (hamburger drawer / navigation drawer) que permita alternar entre `Dashboard`, `Biblioteca` y la próxima sección de `Configuración`.
4. Enrutamiento robusto en `App.tsx` que preserve la vista de origen (`previousView`) al navegar contextual mente hacia la vista de detalle de un libro (`BookDetailPage`) y al regresar.

---

## Decisiones de Diseño y Arquitectura

### 1. Ventana Frameless y TitleBar Nativa Personalizada
- **Decisión:**
  - En Electron Main (`src/main/index.ts`): se inicializa `BrowserWindow` con `frame: false`.
  - En el componente `TitleBar.tsx`:
    - El contenedor principal utiliza `-webkit-app-region: drag` para permitir arrastrar y mover la ventana libremente.
    - Todos los elementos interactivos (botón menú hamburguesa, controles de minimizar, maximizar y cerrar) usan `-webkit-app-region: no-drag`.
    - Lado izquierdo: Botón de menú hamburguesa (Lucide `Menu`) y marca BookLog con ícono de libro (Lucide `BookOpen`).
    - Lado derecho: Botones de control de ventana:
      - Minimizar (Lucide `Minus`).
      - Maximizar/Restaurar (Lucide `Square` / `Copy`).
      - Cerrar (Lucide `X`) con estado de hover rojo (`hover:bg-red-600`).
- **Razón:** Ofrece una apariencia moderna consistente con sistemas operativos contemporáneos manteniendo control visual pleno sin depender del marco del SO.

### 2. Canales IPC Fuertemente Tipados para Control de Ventana
- **Decisión:**
  - Canales en `IPC_CHANNELS.WINDOW`:
    - `window:minimize`: `mainWindow.minimize()` -> `IpcResult<void>`
    - `window:maximize`: alterna entre `unmaximize()` y `maximize()` -> `IpcResult<boolean>`
    - `window:close`: `mainWindow.close()` -> `IpcResult<void>`
    - `window:isMaximized`: consulta `mainWindow.isMaximized()` -> `IpcResult<boolean>`
  - Exposición en Preload con `contextBridge.exposeInMainWorld('api', { window: ... })`.
  - Capa de servicio segura en renderer (`windowService.ts`) con fallback preventivo en entornos de testing y web.
- **Razón:** Mantiene el aislamiento de contexto (`contextIsolation: true`) y respeta el principio de mínimo privilegio en Electron sin exponer APIs directas de Node ni BrowserWindow al renderer.

### 3. Drawer Lateral Accesible (`NavigationDrawer`)
- **Decisión:**
  - Componente accesible con `role="dialog"` y `aria-modal="true"`.
  - Apertura al pulsar el botón hamburguesa en `TitleBar`.
  - Cierre mediante:
    - Tecla `Escape`.
    - Clic en el backdrop oscuro semitransparente.
    - Clic en el botón cerrar (`X`).
    - Selección de una opción de navegación.
  - Enlaces de navegación:
    - **Dashboard** (`LayoutDashboard`)
    - **Biblioteca** (`Library`)
    - **Configuración** (`Settings`)
  - Indicador visual claro del elemento activo y pie de panel con versión de la app (`BookLog v0.1.0`).
- **Razón:** Brinda una navegación escalable para la aplicación que aloja secciones principales y futuras configuraciones sin sobrecargar la barra superior.

### 4. Enrutamiento Shell y Preservación de Historial Contextual en `App.tsx`
- **Decisión:**
  - Vistas soportadas:
    ```typescript
    export type AppView =
      | { type: 'library' }
      | { type: 'dashboard' }
      | { type: 'settings' }
      | { type: 'detail'; bookId: number }
    ```
  - Estado `previousView`: almacena `'library'`, `'dashboard'` o `'settings'`.
  - Al abrir un libro desde la biblioteca o dashboard hacia `BookDetailPage`, al presionar "Volver" el usuario regresa a la pantalla exacta desde la que accedió.
  - Se implementa `SettingsPage.tsx` provisional con diseño limpio, preparado para la Feature #15.
- **Razón:** Garantiza fluidez de navegación y coherencia entre las múltiples fuentes de acceso a la ficha de libro.

---

## Consecuencias y Verificación
- **Pruebas Automatizadas:**
  - `tests/ipc/test_ipc_contracts.test.ts`: Pruebas de integración de los contratos IPC `window:*` con minimización, alternancia maximizar/restaurar, cierre, estado maximizado y manejo de errores cuando no hay ventana activa.
  - `tests/renderer/test_app_navigation_layout.test.ts`: Pruebas completas de renderizado de `TitleBar`, invocación de acciones de ventana, apertura/cierre accesible del drawer (`Escape`, backdrop, botón X, selección), navegación a `SettingsPage`, y preservación del historial de retorno contextual.
- **Métricas:** 18 archivos de prueba, 297 tests pasando en verde, typecheck y linter sin advertencias ni errores.
