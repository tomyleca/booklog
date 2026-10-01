import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LibraryPage } from './pages/LibraryPage.js'
import { BookDetailPage } from './pages/BookDetailPage.js'

export type AppView =
  | { type: 'library' }
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

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        {view.type === 'library' ? (
          <LibraryPage onSelectBook={(bookId) => setView({ type: 'detail', bookId })} />
        ) : (
          <BookDetailPage
            bookId={view.bookId}
            onBack={() => setView({ type: 'library' })}
          />
        )}
      </div>
    </QueryClientProvider>
  )
}

export default App
