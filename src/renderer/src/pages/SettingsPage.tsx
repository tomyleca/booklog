import { useState, useEffect } from 'react'
import {
  Settings,
  Key,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Database,
  Shield,
  Info,
  ExternalLink,
  Tablet,
  FileText,
  NotebookPen
} from 'lucide-react'
import { settingsService } from '../services/settingsService.js'
import { themeService } from '../services/themeService.js'
import { KindleImportModal } from '../components/KindleImportModal.js'
import { KindleNotebookFolderField } from '../components/KindleNotebookFolderField.js'
import type {
  AppTheme,
  AppInfoDTO,
  KindleImportSource
} from '../../../shared/infrastructure/ipc/contracts.js'

interface TestStatus {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

export function SettingsPage(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [theme, setTheme] = useState<AppTheme>('light')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>({ status: 'idle' })
  const [appInfo, setAppInfo] = useState<AppInfoDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [kindleImportSource, setKindleImportSource] = useState<KindleImportSource | null>(null)

  // Load initial settings and app information
  useEffect(() => {
    let isMounted = true

    async function loadData(): Promise<void> {
      try {
        const [settingsRes, infoRes] = await Promise.all([
          settingsService.get(),
          settingsService.getAppInfo()
        ])

        if (isMounted) {
          if (settingsRes.success && settingsRes.data) {
            setApiKey(settingsRes.data.googleBooksApiKey || '')
            setTheme(settingsRes.data.theme || 'light')
            themeService.applyTheme(settingsRes.data.theme || 'light')
          }
          if (infoRes.success && infoRes.data) {
            setAppInfo(infoRes.data)
          }
        }
      } catch {
        // Fallback to defaults
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  // Handle theme change
  const handleThemeChange = async (newTheme: AppTheme): Promise<void> => {
    setTheme(newTheme)
    themeService.applyTheme(newTheme)
    themeService.setupSystemThemeListener(newTheme)
    try {
      await settingsService.save({ theme: newTheme })
    } catch {
      // Revert if failed
    }
  }

  // Handle API key test
  const handleTestApiKey = async (): Promise<void> => {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      setTestStatus({
        status: 'error',
        message: 'Introduce una clave de API antes de realizar la prueba.'
      })
      return
    }

    setTestStatus({ status: 'loading' })
    try {
      const res = await settingsService.testApiKey(trimmed)
      if (res.success) {
        if (res.data.valid) {
          setTestStatus({
            status: 'success',
            message: 'Clave de API válida y conectada correctamente.'
          })
        } else {
          setTestStatus({
            status: 'error',
            message: 'Clave de API inválida o cuota superada'
          })
        }
      } else {
        setTestStatus({
          status: 'error',
          message: res.error || 'Clave de API inválida o cuota superada'
        })
      }
    } catch (err) {
      setTestStatus({
        status: 'error',
        message: err instanceof Error ? err.message : 'Error al conectar con Google Books API'
      })
    }
  }

  // Handle save API key
  const handleSaveApiKey = async (): Promise<void> => {
    setIsSavingKey(true)
    setSaveSuccess(false)
    try {
      const res = await settingsService.save({ googleBooksApiKey: apiKey.trim() })
      if (res.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } finally {
      setIsSavingKey(false)
    }
  }

  return (
    <div
      data-testid="settings-page"
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-md bg-leather texture-wood text-brass border border-backdrop/30 shadow-sm">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Configuración
          </h1>
          <p className="text-sm text-ink-muted">
            Personaliza tus preferencias de lectura, visualización y gestión local de BookLog.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Google Books API */}
        <section
          data-testid="google-books-settings-section"
          className="ficha rounded-md p-6"
        >
          <div className="flex items-center gap-2.5 mb-2 text-ink font-semibold text-base">
            <Key className="w-5 h-5 text-accent" />
            <h2>Google Books API</h2>
          </div>
          <p className="text-xs text-ink-muted mb-5 leading-relaxed">
            Configura tu propia clave de API de Google Books para realizar búsquedas sin restricciones
            de cuota compartida. Si no tienes una, puedes consultar la API pública sin clave con límites estándar.
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="googleBooksApiKey"
                className="block text-xs font-medium text-ink mb-1.5"
              >
                Clave de API (Google Books API Key)
              </label>
              <div className="relative flex items-center">
                <input
                  id="googleBooksApiKey"
                  data-testid="api-key-input"
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    if (testStatus.status !== 'idle') {
                      setTestStatus({ status: 'idle' })
                    }
                  }}
                  placeholder="AIzaSy..."
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 pr-11 rounded-md text-sm bg-well border border-rule text-ink placeholder:text-ink-faint focus:outline-hidden focus:ring-2 focus:ring-accent/50 focus:border-accent font-mono transition-colors"
                />
                <button
                  type="button"
                  data-testid="toggle-api-key-visibility"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  aria-label={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  className="absolute right-3 text-ink-muted hover:text-ink transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Test feedback */}
            {testStatus.status !== 'idle' && (
              <div
                data-testid="api-key-feedback"
                className={`p-3 rounded-md flex items-center gap-2.5 text-xs transition-all ${
                  testStatus.status === 'success'
                    ? 'bg-success/10 text-success border border-success/30'
                    : testStatus.status === 'error'
                      ? 'bg-danger/10 text-danger border border-danger/30'
                      : 'bg-accent/10 text-accent border border-accent/20'
                }`}
              >
                {testStatus.status === 'loading' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                    <span>Verificando conexión con Google Books API...</span>
                  </>
                )}
                {testStatus.status === 'success' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span>{testStatus.message}</span>
                  </>
                )}
                {testStatus.status === 'error' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                    <span>{testStatus.message}</span>
                  </>
                )}
              </div>
            )}

            {/* Save success feedback */}
            {saveSuccess && (
              <div
                data-testid="save-success-indicator"
                className="p-3 rounded-md flex items-center gap-2.5 text-xs bg-success/10 text-success border border-success/30 animate-in fade-in"
              >
                <Check className="w-4 h-4 text-success shrink-0" />
                <span>Clave de API guardada correctamente de forma segura.</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                data-testid="test-api-key-button"
                onClick={handleTestApiKey}
                disabled={isLoading || testStatus.status === 'loading'}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-shelf text-ink hover:bg-rule border border-rule transition-colors disabled:opacity-50 cursor-pointer"
              >
                {testStatus.status === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Key className="w-3.5 h-3.5" />
                )}
                <span>Probar conexión</span>
              </button>

              <button
                type="button"
                data-testid="save-api-key-button"
                onClick={handleSaveApiKey}
                disabled={isLoading || isSavingKey}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-accent text-accent-ink hover:bg-accent-strong transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingKey ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Guardar clave</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 2: Appearance & Theme */}
        <section
          data-testid="appearance-settings-section"
          className="ficha rounded-md p-6"
        >
          <div className="flex items-center gap-2.5 mb-2 text-ink font-semibold text-base">
            <Sun className="w-5 h-5 text-accent" />
            <h2>Preferencias Generales y Tema</h2>
          </div>
          <p className="text-xs text-ink-muted mb-5">
            Selecciona la paleta visual de BookLog. El tema del sistema adaptará la interfaz automáticamente a la configuración de tu sistema operativo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Dark Theme Option */}
            <button
              type="button"
              data-testid="theme-option-dark"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-md border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'dark'
                  ? 'bg-accent/10 border-accent text-accent shadow-xs'
                  : 'bg-card/60 border-rule text-ink-muted hover:border-rule-strong'
              }`}
            >
              <div
                className={`p-2 rounded-md ${
                  theme === 'dark'
                    ? 'bg-leather text-brass'
                    : 'bg-shelf text-ink-muted'
                }`}
              >
                <Moon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Oscuro</span>
              <span className="text-[11px] text-ink-faint">
                Biblioteca de noche: nogal, cuero y luz cálida
              </span>
            </button>

            {/* Light Theme Option */}
            <button
              type="button"
              data-testid="theme-option-light"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-md border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'light'
                  ? 'bg-accent/10 border-accent text-accent shadow-xs'
                  : 'bg-card/60 border-rule text-ink-muted hover:border-rule-strong'
              }`}
            >
              <div
                className={`p-2 rounded-md ${
                  theme === 'light'
                    ? 'bg-leather text-brass'
                    : 'bg-shelf text-ink-muted'
                }`}
              >
                <Sun className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Claro</span>
              <span className="text-[11px] text-ink-faint">
                Papel de pergamino con tinta marrón
              </span>
            </button>

            {/* System Theme Option */}
            <button
              type="button"
              data-testid="theme-option-system"
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-md border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'system'
                  ? 'bg-accent/10 border-accent text-accent shadow-xs'
                  : 'bg-card/60 border-rule text-ink-muted hover:border-rule-strong'
              }`}
            >
              <div
                className={`p-2 rounded-md ${
                  theme === 'system'
                    ? 'bg-leather text-brass'
                    : 'bg-shelf text-ink-muted'
                }`}
              >
                <Monitor className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Sistema</span>
              <span className="text-[11px] text-ink-faint">
                Sincronización automática con el sistema operativo
              </span>
            </button>
          </div>
        </section>

        {/* Section: Kindle import (feature #23) */}
        <section data-testid="kindle-import-settings-section" className="ficha rounded-md p-6">
          <div className="flex items-center gap-2.5 mb-2 text-ink font-semibold text-base">
            <Tablet className="w-5 h-5 text-accent" />
            <h2>Importar del Kindle</h2>
          </div>
          <p className="text-xs text-ink-muted mb-5 leading-relaxed">
            Trae tus subrayados y notas desde el archivo My Clippings.txt del Kindle. Conectalo por
            USB y BookLog lo busca solo; si no lo encuentra, podés elegir el archivo a mano. Antes
            de guardar vas a ver una vista previa por libro, y reimportar no duplica nada.
          </p>
          <p className="text-xs text-ink-muted mb-5 leading-relaxed">
            Los Kindle con firmware reciente ya no guardan los subrayados nuevos en My Clippings.txt.
            Para esos libros (y para las notas escritas en el celular) usá{' '}
            <span className="font-semibold">Exportar cuaderno</span> en la app de Kindle para PC e
            importá las exportaciones: lo que ya llegó por My Clippings no se duplica.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="kindle-import-button"
              onClick={() => setKindleImportSource('DEVICE')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-accent text-accent-ink hover:bg-accent-strong transition-colors shadow-xs cursor-pointer"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Importar del Kindle</span>
            </button>
            <button
              type="button"
              data-testid="kindle-import-file-button"
              onClick={() => setKindleImportSource('FILE')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-shelf text-ink hover:bg-rule border border-rule transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Elegir archivo .txt</span>
            </button>
            <button
              type="button"
              data-testid="kindle-notebook-import-button"
              onClick={() => setKindleImportSource('NOTEBOOK')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-shelf text-ink hover:bg-rule border border-rule transition-colors cursor-pointer"
            >
              <NotebookPen className="w-3.5 h-3.5" />
              <span>Importar exportaciones de la app</span>
            </button>
          </div>
          <KindleNotebookFolderField />
        </section>

        {/* Section 3: Database & Local Storage */}
        <section
          data-testid="storage-settings-section"
          className="ficha rounded-md p-6"
        >
          <div className="flex items-center gap-2.5 mb-2 text-ink font-semibold text-base">
            <Database className="w-5 h-5 text-accent" />
            <h2>Almacenamiento Local</h2>
          </div>
          <p className="text-xs text-ink-muted mb-4">
            Gestión de la base de datos SQLite y portadas descargadas localmente en tu equipo.
          </p>
          <div className="bg-well rounded-md p-4 border border-rule/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-ink block">
                Motor de base de datos
              </span>
              <span className="text-[11px] text-ink-muted block">
                SQLite local a través de Prisma Client
              </span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-success/10 text-success border border-success/30">
              Activo
            </span>
          </div>
        </section>

        {/* Section 4: Privacy & Data */}
        <section
          data-testid="privacy-settings-section"
          className="ficha rounded-md p-6"
        >
          <div className="flex items-center gap-2.5 mb-2 text-ink font-semibold text-base">
            <Shield className="w-5 h-5 text-accent" />
            <h2>Privacidad y Datos</h2>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            Tus datos de lectura, notas y portadas residen 100% en tu dispositivo. No se comparten con
            servidores de terceros, salvo las consultas directas a Google Books para buscar libros y obtener portadas.
          </p>
        </section>

        {/* Section 5: About BookLog */}
        <section
          data-testid="about-settings-section"
          className="ficha rounded-md p-6"
        >
          <div className="flex items-center gap-2.5 mb-3 text-ink font-semibold text-base">
            <Info className="w-5 h-5 text-accent" />
            <h2>Acerca de BookLog</h2>
          </div>

          <div className="space-y-4">
            <p className="font-semibold text-ink text-sm">
              BookLog v{appInfo?.version ?? '0.1.0'}
            </p>
            <p className="text-xs text-ink-muted">
              Aplicación de escritorio para registro, seguimiento y notas de lecturas personales construida con Electron, React, TypeScript y Tailwind CSS.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-well p-3 rounded-md border border-rule/80">
                <span className="text-[11px] text-ink-faint block">Versión App</span>
                <span data-testid="app-version" className="text-xs font-semibold text-ink font-mono">
                  v{appInfo?.version ?? '0.1.0'}
                </span>
              </div>

              <div className="bg-well p-3 rounded-md border border-rule/80">
                <span className="text-[11px] text-ink-faint block">Electron</span>
                <span data-testid="electron-version" className="text-xs font-semibold text-ink font-mono">
                  v{appInfo?.electronVersion ?? '28.2.0'}
                </span>
              </div>

              <div className="bg-well p-3 rounded-md border border-rule/80">
                <span className="text-[11px] text-ink-faint block">Node.js</span>
                <span data-testid="node-version" className="text-xs font-semibold text-ink font-mono">
                  v{appInfo?.nodeVersion ?? '18.19.0'}
                </span>
              </div>

              <div className="bg-well p-3 rounded-md border border-rule/80">
                <span className="text-[11px] text-ink-faint block">Chromium</span>
                <span data-testid="chrome-version" className="text-xs font-semibold text-ink font-mono">
                  v{appInfo?.chromeVersion ?? '120.0.0'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-rule text-xs text-ink-muted">
              <div className="flex items-center gap-1.5">
                <span>Licencia:</span>
                <span className="font-semibold text-ink">
                  {appInfo?.license ?? 'MIT'}
                </span>
              </div>
              {appInfo?.repositoryUrl && (
                <a
                  href={appInfo.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:text-accent-strong transition-colors"
                >
                  <span>Repositorio GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>
      </div>

      {kindleImportSource && (
        <KindleImportModal
          initialSource={kindleImportSource}
          onClose={() => setKindleImportSource(null)}
        />
      )}
    </div>
  )
}
