import { Settings, Shield, Sliders, Database, Info } from 'lucide-react'

export function SettingsPage(): JSX.Element {
  return (
    <div
      data-testid="settings-page"
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Configuración</h1>
          <p className="text-sm text-slate-400">
            Personaliza tus preferencias de lectura, visualización y gestión local de BookLog.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* General Settings Section */}
        <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3 text-slate-200 font-semibold text-sm">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h2>Preferencias Generales</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Ajustes de visualización y comportamiento por defecto de la aplicación.
          </p>
          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-200 block">Tema visual</span>
              <span className="text-[11px] text-slate-400 block">Modo oscuro habilitado por defecto</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
              Oscuro (Dark)
            </span>
          </div>
        </section>

        {/* Database & Storage Section */}
        <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3 text-slate-200 font-semibold text-sm">
            <Database className="w-4 h-4 text-indigo-400" />
            <h2>Almacenamiento Local</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Gestión de la base de datos SQLite y portadas almacenadas localmente.
          </p>
          <div className="bg-slate-900/60 rounded-lg p-4 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-200 block">Motor de base de datos</span>
              <span className="text-[11px] text-slate-400 block">SQLite local a través de Prisma Client</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Activo
            </span>
          </div>
        </section>

        {/* Privacy & Security Section */}
        <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2.5 mb-3 text-slate-200 font-semibold text-sm">
            <Shield className="w-4 h-4 text-indigo-400" />
            <h2>Privacidad y Datos</h2>
          </div>
          <p className="text-xs text-slate-400">
            Tus datos de lectura, notas y portadas residen 100% en tu dispositivo. No se comparten con servidores de terceros salvo las consultas opcionales a Google Books.
          </p>
        </section>

        {/* About / Info Section */}
        <section className="bg-slate-800/40 border border-slate-800 rounded-xl p-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-200">BookLog v0.1.0</p>
            <p>
              Aplicación de escritorio construida con Electron, React, TypeScript y Tailwind CSS.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
