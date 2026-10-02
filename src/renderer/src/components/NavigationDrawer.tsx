import { useEffect } from 'react'
import { BookOpen, LayoutDashboard, Library, Settings, X } from 'lucide-react'

export interface NavigationDrawerProps {
  isOpen: boolean
  onClose: () => void
  currentView: 'library' | 'dashboard' | 'settings' | 'detail'
  onNavigate: (view: 'library' | 'dashboard' | 'settings') => void
}

export function NavigationDrawer({
  isOpen,
  onClose,
  currentView,
  onNavigate
}: NavigationDrawerProps): JSX.Element | null {
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const handleSelectNav = (view: 'library' | 'dashboard' | 'settings'): void => {
    onNavigate(view)
    onClose()
  }

  const navItems = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      testId: 'drawer-nav-dashboard',
      description: 'Métricas, resumen y lectura reciente'
    },
    {
      id: 'library' as const,
      label: 'Biblioteca',
      icon: Library,
      testId: 'drawer-nav-library',
      description: 'Gestión y exploración de tus libros'
    },
    {
      id: 'settings' as const,
      label: 'Configuración',
      icon: Settings,
      testId: 'drawer-nav-settings',
      description: 'Preferencias y opciones del sistema'
    }
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal de navegación"
      data-testid="navigation-drawer"
      className="fixed inset-0 z-50 flex"
    >
      {/* Semi-transparent dark backdrop */}
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-out drawer panel */}
      <aside
        data-testid="drawer-panel"
        className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 transition-transform animate-in slide-in-from-left duration-200"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-sm tracking-tight leading-tight">
                BookLog
              </h2>
              <p className="text-[11px] text-slate-400 leading-tight">
                Gestor personal de lectura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            data-testid="drawer-close-button"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto" aria-label="Menú lateral">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id

            return (
              <button
                key={item.id}
                type="button"
                data-testid={item.testId}
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 p-1 rounded-md ${
                    isActive
                      ? 'bg-indigo-600/30 text-indigo-300'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`block text-xs font-semibold ${
                      isActive ? 'text-indigo-200' : 'text-slate-200'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {item.description}
                  </span>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>BookLog</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
              v0.1.0
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
