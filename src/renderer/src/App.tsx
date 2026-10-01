import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Library, BarChart3, BookOpen } from 'lucide-react'
import { LibraryPage } from './pages/LibraryPage.js'
import { BookDetailPage } from './pages/BookDetailPage.js'
import { DashboardPage } from './pages/DashboardPage.js'

export type AppView =
  | { type: 'library' }
  | { type: 'dashboard' }
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
  const [previousView, setPreviousView] = useState<'library' | 'dashboard'>(
    initialView?.type === 'dashboard' ? 'dashboard' : 'library'
  )

  const handleSelectBook = (bookId: number): void => {
    if (view.type === 'library' || view.type === 'dashboard') {
      setPreviousView(view.type)
    }
    setView({ type: 'detail', bookId })
  }

  const handleBackFromDetail = (): void => {
    setView({ type: previousView })
  }

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {/* Navigation Bar */}
        <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20" data-testid="app-navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span className="font-bold text-base text-slate-100 tracking-tight">BookLog</span>
              </div>
              <nav className="flex items-center gap-1.5" aria-label="Navegación principal">
                <button
                  type="button"
                  onClick={() => {
                    setView({ type: 'library' })
                    setPreviousView('library')
                  }}
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
                  onClick={() => {
                    setView({ type: 'dashboard' })
                    setPreviousView('dashboard')
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    view.type === 'dashboard'
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  data-testid="nav-dashboard-button"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1">
          {view.type === 'library' && (
            <LibraryPage onSelectBook={handleSelectBook} />
          )}
          {view.type === 'dashboard' && (
            <DashboardPage onSelectBook={handleSelectBook} />
          )}
          {view.type === 'detail' && (
            <BookDetailPage
              bookId={view.bookId}
              onBack={handleBackFromDetail}
            />
          )}
        </div>
      </div>
    </QueryClientProvider>
  )
}

export default App
