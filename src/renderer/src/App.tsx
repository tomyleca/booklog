import { BookOpen } from 'lucide-react'

function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      <header className="text-center flex flex-col items-center gap-4">
        <BookOpen className="w-16 h-16 text-indigo-400" />
        <h1 className="text-4xl font-bold tracking-tight">BookLog</h1>
        <p className="text-slate-400 text-lg">Tu registro personal de lecturas</p>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
          React + Electron + Tailwind CSS v4
        </span>
      </header>
    </div>
  )
}

export default App
