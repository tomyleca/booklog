import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LibraryPage } from './pages/LibraryPage.js'

export interface AppProps {
  queryClient?: QueryClient
}

export function App({ queryClient }: AppProps): JSX.Element {
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

  return (
    <QueryClientProvider client={client}>
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        <LibraryPage />
      </div>
    </QueryClientProvider>
  )
}

export default App
