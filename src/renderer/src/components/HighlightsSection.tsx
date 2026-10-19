import { Calendar, Highlighter, Loader2, MapPin, MessageSquare, Trash2 } from 'lucide-react'
import type {
  HighlightPrimitives,
  NotePrimitives
} from '../../../shared/infrastructure/ipc/contracts.js'
import {
  formatAnnotationDate,
  formatAnnotationLocation,
  groupNotesByHighlight,
  highlightColorMark
} from './annotations.js'

export interface HighlightsSectionProps {
  highlights: HighlightPrimitives[] | undefined
  notes: NotePrimitives[]
  isLoading: boolean
  errorMessage: string | null
  isDeleting: boolean
  onDelete: (highlightId: number) => void
}

/**
 * Lo resaltado del libro (feature #22). Las notas vinculadas a un subrayado se repiten
 * debajo de él como comentario; siguen siendo notas del usuario y viven en "Mis notas".
 */
export function HighlightsSection({
  highlights,
  notes,
  isLoading,
  errorMessage,
  isDeleting,
  onDelete
}: HighlightsSectionProps): JSX.Element {
  const notesByHighlight = groupNotesByHighlight(notes)

  return (
    <section
      className="mt-8 pt-8 border-t-[3px] border-double border-rule-strong"
      data-testid="highlights-section"
    >
      <div className="flex items-center gap-2.5 mb-6">
        <h2 className="text-xl font-bold text-ink flex items-center gap-2">
          <Highlighter className="w-5 h-5 text-accent" />
          <span>Subrayados</span>
        </h2>
        {highlights && !isLoading && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full bg-shelf text-ink-muted border border-rule/60"
            data-testid="highlights-count-badge"
          >
            {highlights.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8 text-ink-muted gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span className="text-xs">Cargando subrayados...</span>
        </div>
      )}

      {errorMessage && (
        <div
          className="p-4 rounded-md border border-danger/30 bg-danger/10 text-danger text-xs"
          data-testid="highlights-error"
        >
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && highlights && highlights.length === 0 && (
        <div
          className="py-8 px-4 text-center rounded-md border-2 border-dashed border-rule-strong/70 bg-card/50 texture-paper text-ink-muted"
          data-testid="no-highlights-message"
        >
          <p className="text-sm font-semibold text-ink">Este libro no tiene subrayados</p>
          <p className="text-xs text-ink-faint mt-1">
            Los fragmentos que resaltes en el Kindle aparecerán acá al importarlos.
          </p>
        </div>
      )}

      {!isLoading && !errorMessage && highlights && highlights.length > 0 && (
        <ol className="flex flex-col gap-4" data-testid="highlights-list">
          {highlights.map((highlight) => {
            const highlightId = highlight.id
            const linkedNotes =
              highlightId !== undefined ? (notesByHighlight.get(highlightId) ?? []) : []
            const capturedAt = formatAnnotationDate(highlight.capturedAt)
            const colorMark = highlightColorMark(highlight.color)

            return (
              <li
                key={highlightId ?? highlight.fingerprint}
                className="group p-4 rounded-md ficha hover:border-rule-strong transition-all"
                data-testid="highlight-item"
              >
                <blockquote
                  className="pl-3 border-l-4 border-accent/60 text-sm text-ink italic whitespace-pre-wrap leading-relaxed break-words"
                  data-testid="highlight-content"
                >
                  {highlight.content}
                </blockquote>

                {linkedNotes.length > 0 && (
                  <ul className="mt-3 ml-3 flex flex-col gap-2">
                    {linkedNotes.map((note) => (
                      <li
                        key={note.id ?? note.content}
                        className="flex items-start gap-2 p-2 rounded-md bg-well border border-rule/60 text-xs text-ink"
                        data-testid="highlight-linked-note"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                        <span className="whitespace-pre-wrap break-words">{note.content}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-rule text-[11px] text-ink-muted">
                  <div className="flex items-center gap-3">
                    {colorMark && (
                      <span
                        className="flex items-center gap-1"
                        title={`Subrayado ${colorMark.label.toLowerCase()}`}
                        data-testid="highlight-color"
                      >
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full border border-rule-strong ${colorMark.className}`}
                          aria-hidden="true"
                        />
                        {colorMark.label}
                      </span>
                    )}
                    <span className="flex items-center gap-1" data-testid="highlight-location">
                      <MapPin className="w-3 h-3" />
                      {formatAnnotationLocation(highlight.location)}
                    </span>
                    {capturedAt && (
                      <span className="flex items-center gap-1" data-testid="highlight-date">
                        <Calendar className="w-3 h-3" />
                        {capturedAt}
                      </span>
                    )}
                  </div>

                  {highlightId !== undefined && (
                    <button
                      type="button"
                      onClick={() => onDelete(highlightId)}
                      disabled={isDeleting}
                      className="p-1 text-ink-muted hover:text-danger rounded hover:bg-danger/10 transition-colors opacity-80 group-hover:opacity-100"
                      title="Eliminar subrayado (sus notas se conservan)"
                      data-testid={`delete-highlight-button-${highlightId}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
