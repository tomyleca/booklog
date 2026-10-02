import { useState, useEffect } from 'react'
import { Menu, BookOpen, Minus, Square, Copy, X } from 'lucide-react'
import { windowService } from '../services/windowService.js'

export interface TitleBarProps {
  onToggleMenu?: () => void
  title?: string
}

export function TitleBar({ onToggleMenu, title = 'BookLog' }: TitleBarProps): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    let mounted = true
    windowService.isMaximized().then((res) => {
      if (mounted && res.success) {
        setIsMaximized(res.data)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  const handleMinimize = async (): Promise<void> => {
    await windowService.minimize()
  }

  const handleMaximize = async (): Promise<void> => {
    const res = await windowService.maximize()
    if (res.success) {
      setIsMaximized(res.data)
    }
  }

  const handleClose = async (): Promise<void> => {
    await windowService.close()
  }

  return (
    <div
      data-testid="app-titlebar"
      className="h-9 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between select-none text-xs text-slate-300 z-50 sticky top-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Hamburger menu & Brand */}
      <div
        className="flex items-center gap-2.5 px-3 h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Abrir menú de navegación"
          data-testid="titlebar-menu-button"
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-slate-200 tracking-tight text-xs">
            {title}
          </span>
        </div>
      </div>

      {/* Center: Draggable area */}
      <div className="flex-1 h-full flex items-center justify-center text-slate-500 text-[11px] pointer-events-none">
        {/* Subtle center placeholder or title if needed */}
      </div>

      {/* Right: Window Controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimizar ventana"
          data-testid="window-minimize-button"
          className="w-10 h-full inline-flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'}
          data-testid="window-maximize-button"
          className="w-10 h-full inline-flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar ventana"
          data-testid="window-close-button"
          className="w-10 h-full inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
