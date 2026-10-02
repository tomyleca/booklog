# ADR-015: Página de Configuración, Persistencia de Preferencias y Tema (`settings_page`)

## Estado
Aceptado

## Contexto
BookLog requería un mecanismo robusto y seguro para que los usuarios gestionen sus preferencias locales, incluyendo:
1. Configuración y prueba de una clave de API de Google Books propia para superar las cuotas compartidas estándar sin exponer claves hardcodeadas.
2. Selección de tema visual ("Oscuro", "Claro", "Sistema") con sincronización reactiva inmediata de estilos Tailwind CSS v4.
3. Almacenamiento seguro y persistente de las preferencias en el proceso Main (`userData/settings.json`) con cifrado mediante Electron `safeStorage` cuando esté disponible.
4. Consulta transparente de metadatos del entorno y la aplicación (versión de BookLog, Electron, Node.js, Chromium, repositorio y licencia).

---

## Decisiones de Diseño y Arquitectura

### 1. Servicio de Persistencia Nativo (`SettingsStorageService`)
- **Decisión:**
  - Se creó [`SettingsStorageService`](file:///c:/Users/Tomas/Desktop/BookLog/booklog/src/main/services/SettingsStorageService.ts) en el proceso principal (`src/main/services/SettingsStorageService.ts`).
  - Ubicación del archivo de configuración: `app.getPath('userData')/settings.json` (con resolución segura a `process.cwd()` en entornos sin Electron / tests).
  - Estructura del modelo de configuración:
    ```typescript
    export type AppTheme = 'dark' | 'light' | 'system'
    export interface AppSettings {
      googleBooksApiKey: string
      theme: AppTheme
    }
    ```
  - **Cifrado con `safeStorage`:** Si `safeStorage.isEncryptionAvailable()` retorna `true`, la clave de Google Books se cifra como buffer en Base64 en `encryptedGoogleBooksApiKey`. Si el cifrado no está disponible o la desencriptación falla, se utiliza un fallback seguro en texto plano.
  - **Cache en memoria:** Mantiene un cache síncrono accesible mediante `getCachedApiKey()` para abastecer inmediatamente a servicios dependientes sin latencia de I/O.
- **Razón:** Aísla el acceso al sistema de archivos local en el proceso Node.js principal y protege credenciales sensibles de los usuarios.

### 2. Canales IPC y Contratos Fuertemente Tipados
- **Decisión:**
  - Nuevos canales en `src/shared/infrastructure/ipc/channels.ts`:
    ```typescript
    SETTINGS: {
      GET: 'settings:get',
      SAVE: 'settings:save',
      TEST_API_KEY: 'settings:testApiKey',
      GET_APP_INFO: 'settings:getAppInfo'
    }
    ```
  - DTOs tipados en `src/shared/infrastructure/ipc/contracts.ts`:
    - `AppSettingsDTO`: estado completo de ajustes.
    - `SaveSettingsDTO`: actualización parcial (`googleBooksApiKey?`, `theme?`).
    - `TestApiKeyDTO` y `TestApiKeyResultDTO`: validación de clave externa.
    - `AppInfoDTO`: versión de la app, Electron, Node, Chromium, URL del repo y licencia.
  - Handlers en `src/main/ipc/settingsHandlers.ts` registrados centralizadamente en `src/main/ipc/index.ts`.
- **Razón:** Respeta la arquitectura en capas y garantiza que el proceso de renderizado solo interactúe mediante canales estrictamente tipados y validados.

### 3. Prueba Activa de Conectividad con Google Books API
- **Decisión:**
  - En el handler de `settings:testApiKey`, se realiza una petición HTTP GET de verificación a:
    `https://www.googleapis.com/books/v1/volumes?q=test&key=${encodeURIComponent(apiKey)}`
  - Utiliza `AbortController` con un timeout de 8 segundos para evitar bloqueos por latencia de red.
  - Si el código de respuesta HTTP es 200, devuelve `{ success: true, data: { valid: true } }`.
  - Si la API responde con 400, 403 u otro error, o si la clave está vacía, devuelve `{ success: false, error: 'Clave de API inválida o cuota superada' }`.
- **Razón:** Permite al usuario verificar que su clave es válida antes de guardarla.

### 4. Inyección Dinámica de API Key en `GoogleBooksService`
- **Decisión:**
  - En `src/main/ipc/index.ts`, se conecta `GoogleBooksService` con un proveedor dinámico `() => settingsService.getCachedApiKey()`.
  - Cuando el usuario guarda o actualiza su clave, el cache se actualiza en memoria y las búsquedas posteriores de libros utilizan la nueva clave automáticamente sin reiniciar la app.
- **Razón:** Asegura que los módulos de búsqueda aprovechen la configuración sin acoplamientos rígidos.

### 5. Gestión Reactiva del Tema Visual (Tailwind CSS v4)
- **Decisión:**
  - Se configuró la variante personalizada `@custom-variant dark (&:where(.dark, .dark *));` en `src/renderer/src/assets/main.css`.
  - Se creó el servicio `themeService` (`src/renderer/src/services/themeService.ts`) que:
    - Agrega o quita la clase `dark` en `document.documentElement`.
    - En modo `system`, evalúa `window.matchMedia('(prefers-color-scheme: dark)').matches` y suscribe un listener para cambios en el esquema del sistema operativo.
  - `App.tsx` inicializa el tema guardado al arrancar, y `SettingsPage.tsx` aplica reactivamente cualquier cambio en tiempo real al hacer clic en las opciones ("Oscuro", "Claro", "Sistema").
- **Razón:** Proporciona retroalimentación visual inmediata sin parpadeos ni recargas de página.

### 6. Interfaz de Usuario (`SettingsPage.tsx`)
- **Decisión:**
  - Sección Google Books: input con alternancia ver/ocultar contraseña (`Eye`/`EyeOff`), botón "Probar conexión" con spinner de carga, y botón "Guardar clave".
  - Sección Tema: tarjetas interactivas para "Oscuro" (`Moon`), "Claro" (`Sun`) y "Sistema" (`Monitor`).
  - Sección Almacenamiento y Privacidad: estado de SQLite local y confirmación de privacidad 100% en dispositivo.
  - Sección Acerca de BookLog: desglose de versiones de App, Electron, Node, Chromium, licencia y enlace al repositorio.

---

## Consecuencias
- **Positivas:**
  - Configuración persistente y cifrada de credenciales del usuario.
  - Cambio instantáneo entre temas claro, oscuro y automático de sistema.
  - Búsquedas con Google Books API potenciadas con cuota propia del usuario.
  - Cumplimiento riguroso de TypeScript, ESLint y 100% de tests unitarios e integrados pasando.
- **Neutrales:**
  - Cuando `safeStorage` no está disponible (ej. entornos de CI o pruebas headless sin keyring del SO), el servicio almacena de forma transparente en texto plano para asegurar portabilidad sin errores de ejecución.
