import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Library, LayoutDashboard, Settings } from 'lucide-react'
import { LibraryPage } from './pages/LibraryPage.js'
import { BookDetailPage } from './pages/BookDetailPage.js'
import { DashboardPage } from './pages/DashboardPage.js'
import { SettingsPage } from './pages/SettingsPage.js'
import { TitleBar } from './components/TitleBar.js'
import { NavigationDrawer } from './components/NavigationDrawer.js'

export type NavViewType = 'library' | 'dashboard' | 'settings'

export type AppView =
  | { type: 'library' }
  | { type: 'dashboard' }
  | { type: 'settings' }
  | { type: 'detail'; bookId: number }

export interface AppProps {
  queryClient?: QueryClient
  initialView?: AppView
}

export function App({ queryClient, initialView }: AppProps): JSX.Element {
  const [client] = useState(
    () =>
      queryClient ??
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 1000 * 60 * 5
          }
        }
      })
  )

  const [view, setView] = useState<AppView>(initialView ?? { type: 'library' })
  const [previousView, setPreviousView] = useState<NavViewType>(
    initialView?.type === 'dashboard'
      ? 'dashboard'
      : initialView?.type === 'settings'
        ? 'settings'
        : 'library'
  )
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleSelectBook = (bookId: number): void => {
    if (view.type === 'library' || view.type === 'dashboard' || view.type === 'settings') {
      setPreviousView(view.type)
    }
    setView({ type: 'detail', bookId })
  }

  const handleBackFromDetail = (): void => {
    setView({ type: previousView })
  }

  const handleNavigate = (target: NavViewType): void => {
    setView({ type: target })
    setPreviousView(target)
  }

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Custom Frameless TitleBar */}
        <TitleBar onToggleMenu={() => setIsDrawerOpen((prev) => !prev)} />

        {/* Drawer Navigation */}
        <NavigationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          currentView={view.type}
          onNavigate={handleNavigate}
        />

        {/* Main Navigation Bar */}
        <header
          className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-9 z-20"
          data-testid="app-navigation"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
            <nav className="flex items-center gap-1.5" aria-label="Navegación principal">
              <button
                type="button"
                onClick={() => handleNavigate('library')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view.type === 'library'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                data-testid="nav-library-button"
              >
                <Library className="w-3.5 h-3.5" />
                <span>Biblioteca</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('dashboard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view.type === 'dashboard'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                data-testid="nav-dashboard-button"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('settings')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view.type === 'settings'
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                data-testid="nav-settings-button"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuración</span>
              </button>
            </nav>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1">
          {view.type === 'library' && (
            <LibraryPage onSelectBook={handleSelectBook} />
          )}
          {view.type === 'dashboard' && (
            <DashboardPage onSelectBook={handleSelectBook} />
          )}
          {view.type === 'settings' && (
            <SettingsPage />
          )}
          {view.type === 'detail' && (
            <BookDetailPage
              bookId={view.bookId}
              onBack={handleBackFromDetail}
            />
          )}
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App
