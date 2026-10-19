import { useEffect, useState } from 'react'
import { FolderOpen, RotateCcw } from 'lucide-react'
import { kindleService } from '../services/kindleService.js'
import type {
  IpcResult,
  KindleNotebookFolderDTO
} from '../../../shared/infrastructure/ipc/contracts.js'

const BUTTON =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-shelf text-ink hover:bg-rule border border-rule transition-colors cursor-pointer disabled:opacity-50'

/**
 * Carpeta donde se buscan las exportaciones del Cuaderno de la app de Kindle (feature #26).
 * Por defecto Documentos; se cambia con el diálogo nativo de carpetas (el main la guarda en
 * settings.json) y "Usar Documentos" vuelve a la predeterminada.
 */
export function KindleNotebookFolderField(): JSX.Element {
  const [folder, setFolder] = useState<KindleNotebookFolderDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    kindleService
      .getNotebookFolder()
      .then((res) => {
        if (mounted && res.success) setFolder(res.data)
      })
      .catch(() => {
        // Sin carpeta conocida se muestra "Documentos"; la búsqueda la resuelve el main.
      })
    return () => {
      mounted = false
    }
  }, [])

  const run = async (
    action: () => Promise<IpcResult<KindleNotebookFolderDTO | null>>
  ): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await action()
      if (!res.success) setError(res.error)
      else if (res.data) setFolder(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la carpeta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2" data-testid="kindle-notebook-folder">
      <p className="text-xs text-ink-muted">
        Carpeta de exportaciones:{' '}
        <span className="font-mono text-ink break-all" data-testid="kindle-notebook-folder-path">
          {folder?.folder ?? 'Documentos'}
        </span>
        {(folder === null || folder.isDefault) && ' (Documentos, predeterminada)'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => kindleService.chooseNotebookFolder())}
          className={BUTTON}
          data-testid="kindle-notebook-folder-choose"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Cambiar carpeta…</span>
        </button>
        {folder !== null && !folder.isDefault && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => kindleService.resetNotebookFolder())}
            className={BUTTON}
            data-testid="kindle-notebook-folder-reset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Usar Documentos</span>
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-danger" data-testid="kindle-notebook-folder-error">
          {error}
        </p>
      )}
    </div>
  )
}
