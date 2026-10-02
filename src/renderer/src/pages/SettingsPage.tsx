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
  ExternalLink
} from 'lucide-react'
import { settingsService } from '../services/settingsService.js'
import { themeService } from '../services/themeService.js'
import type { AppTheme, AppInfoDTO } from '../../../shared/infrastructure/ipc/contracts.js'

interface TestStatus {
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}

export function SettingsPage(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [theme, setTheme] = useState<AppTheme>('dark')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>({ status: 'idle' })
  const [appInfo, setAppInfo] = useState<AppInfoDTO | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
            setTheme(settingsRes.data.theme || 'dark')
            themeService.applyTheme(settingsRes.data.theme || 'dark')
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
        <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Configuración
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Personaliza tus preferencias de lectura, visualización y gestión local de BookLog.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Google Books API */}
        <section
          data-testid="google-books-settings-section"
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-2 text-slate-900 dark:text-slate-200 font-semibold text-base">
            <Key className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2>Google Books API</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
            Configura tu propia clave de API de Google Books para realizar búsquedas sin restricciones
            de cuota compartida. Si no tienes una, puedes consultar la API pública sin clave con límites estándar.
          </p>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="googleBooksApiKey"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
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
                  className="w-full px-3.5 py-2.5 pr-11 rounded-lg text-sm bg-slate-50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 font-mono transition-colors"
                />
                <button
                  type="button"
                  data-testid="toggle-api-key-visibility"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  title={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  aria-label={showApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Test feedback */}
            {testStatus.status !== 'idle' && (
              <div
                data-testid="api-key-feedback"
                className={`p-3 rounded-lg flex items-center gap-2.5 text-xs transition-all ${
                  testStatus.status === 'success'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    : testStatus.status === 'error'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                      : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                }`}
              >
                {testStatus.status === 'loading' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
                    <span>Verificando conexión con Google Books API...</span>
                  </>
                )}
                {testStatus.status === 'success' && (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{testStatus.message}</span>
                  </>
                )}
                {testStatus.status === 'error' && (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{testStatus.message}</span>
                  </>
                )}
              </div>
            )}

            {/* Save success feedback */}
            {saveSuccess && (
              <div
                data-testid="save-success-indicator"
                className="p-3 rounded-lg flex items-center gap-2.5 text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 animate-in fade-in"
              >
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
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
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-2 text-slate-900 dark:text-slate-200 font-semibold text-base">
            <Sun className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2>Preferencias Generales y Tema</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Selecciona la paleta visual de BookLog. El tema del sistema adaptará la interfaz automáticamente a la configuración de tu sistema operativo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Dark Theme Option */}
            <button
              type="button"
              data-testid="theme-option-dark"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'dark'
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  theme === 'dark'
                    ? 'bg-indigo-600/20 text-indigo-500 dark:text-indigo-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Oscuro</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Interfaz con tonos oscuros y contraste suave
              </span>
            </button>

            {/* Light Theme Option */}
            <button
              type="button"
              data-testid="theme-option-light"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'light'
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  theme === 'light'
                    ? 'bg-indigo-600/20 text-indigo-500 dark:text-indigo-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Claro</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Interfaz limpia con fondo claro y alto contraste
              </span>
            </button>

            {/* System Theme Option */}
            <button
              type="button"
              data-testid="theme-option-system"
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                theme === 'system'
                  ? 'bg-indigo-600/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  theme === 'system'
                    ? 'bg-indigo-600/20 text-indigo-500 dark:text-indigo-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Monitor className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold">Sistema</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Sincronización automática con el sistema operativo
              </span>
            </button>
          </div>
        </section>

        {/* Section 3: Database & Local Storage */}
        <section
          data-testid="storage-settings-section"
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-2 text-slate-900 dark:text-slate-200 font-semibold text-base">
            <Database className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2>Almacenamiento Local</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Gestión de la base de datos SQLite y portadas descargadas localmente en tu equipo.
          </p>
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-lg p-4 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-900 dark:text-slate-200 block">
                Motor de base de datos
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                SQLite local a través de Prisma Client
              </span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              Activo
            </span>
          </div>
        </section>

        {/* Section 4: Privacy & Data */}
        <section
          data-testid="privacy-settings-section"
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-2 text-slate-900 dark:text-slate-200 font-semibold text-base">
            <Shield className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2>Privacidad y Datos</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tus datos de lectura, notas y portadas residen 100% en tu dispositivo. No se comparten con
            servidores de terceros, salvo las consultas directas a Google Books para buscar libros y obtener portadas.
          </p>
        </section>

        {/* Section 5: About BookLog */}
        <section
          data-testid="about-settings-section"
          className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-3 text-slate-900 dark:text-slate-200 font-semibold text-base">
            <Info className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            <h2>Acerca de BookLog</h2>
          </div>

          <div className="space-y-4">
            <p className="font-semibold text-slate-900 dark:text-slate-200 text-sm">
              BookLog v{appInfo?.version ?? '0.1.0'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aplicación de escritorio para registro, seguimiento y notas de lecturas personales construida con Electron, React, TypeScript y Tailwind CSS.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Versión App</span>
                <span data-testid="app-version" className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  v{appInfo?.version ?? '0.1.0'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Electron</span>
                <span data-testid="electron-version" className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  v{appInfo?.electronVersion ?? '28.2.0'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Node.js</span>
                <span data-testid="node-version" className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  v{appInfo?.nodeVersion ?? '18.19.0'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80">
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Chromium</span>
                <span data-testid="chrome-version" className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  v{appInfo?.chromeVersion ?? '120.0.0'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Licencia:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {appInfo?.license ?? 'MIT'}
                </span>
              </div>
              {appInfo?.repositoryUrl && (
                <a
                  href={appInfo.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <span>Repositorio GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
