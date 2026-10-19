import { CalendarCheck } from 'lucide-react'
import { todayIsoDate } from '../../../shared/domain/entities/CalendarDate.js'

export interface FinishedDateFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  label?: string
  testId?: string
  /** De dónde sale el valor precargado, p. ej. "Sugerida: último subrayado del Kindle (…)". */
  hint?: string | null
}

export function FinishedDateField({
  id,
  value,
  onChange,
  error,
  label = 'Fecha de terminado',
  testId = 'finished-date-input',
  hint
}: FinishedDateFieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5" data-testid={`${testId}-field`}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <CalendarCheck className="w-3.5 h-3.5 text-status-finished" aria-hidden="true" />
        <span>{label}</span>
      </label>
      <input
        id={id}
        type="date"
        value={value}
        max={todayIsoDate()}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={`w-full px-3 py-1.5 rounded-md bg-well border text-sm text-ink font-mono focus:outline-none focus:ring-2 transition-all ${
          error ? 'border-danger focus:ring-danger/30' : 'border-rule focus:ring-accent/40'
        }`}
        data-testid={testId}
      />
      {hint && (
        <p className="text-xs text-ink-muted" data-testid={`${testId}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs text-danger" data-testid={`${testId}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
