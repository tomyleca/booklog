import { useState } from 'react'
import { BookOpen, Star } from 'lucide-react'
import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import { resolveCoverUrl } from '../services/coverService.js'

export interface BookCardProps {
  book: BookPrimitives
  onClick?: ((book: BookPrimitives) => void) | (() => void)
}

const STATUS_CONFIG: Record<BookStatus, { label: string; badgeClass: string }> = {
  [BookStatus.TO_READ]: {
    label: 'Por leer',
    badgeClass: 'text-status-to-read border-status-to-read/50'
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    badgeClass: 'text-status-reading border-status-reading/50'
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    badgeClass: 'text-status-paused border-status-paused/50'
  },
  [BookStatus.FINISHED]: {
    label: 'Terminado',
    badgeClass: 'text-status-finished border-status-finished/50'
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    badgeClass: 'text-status-abandoned border-status-abandoned/50'
  }
}

const STATUSES_WITH_PROGRESS: readonly BookStatus[] = [
  BookStatus.READING,
  BookStatus.PAUSED,
  BookStatus.ABANDONED
]

// Alterna cuero rojo y verde según el id para que un estante sin tapas no sea monótono.
const PLACEHOLDER_TONES = ['leather', 'spine'] as const
type PlaceholderTone = (typeof PLACEHOLDER_TONES)[number]

const TONE_CLASS: Record<PlaceholderTone, string> = {
  leather: 'bg-leather',
  spine: 'bg-spine'
}

function placeholderTone(bookId: number | undefined): PlaceholderTone {
  return PLACEHOLDER_TONES[Math.abs(bookId ?? 0) % PLACEHOLDER_TONES.length] ?? 'leather'
}

export function BookCard({ book, onClick }: BookCardProps): JSX.Element {
  const [imageError, setImageError] = useState(false)

  const coverUrl = resolveCoverUrl(book.coverPath, book.coverUrl ?? '')
  const hasCover = Boolean(coverUrl && !imageError)
  const tone = placeholderTone(book.id)

  const statusConfig = STATUS_CONFIG[book.status] ?? {
    label: book.status,
    badgeClass: 'text-ink-muted border-rule-strong'
  }

  const showProgress = STATUSES_WITH_PROGRESS.includes(book.status)
  let percentage = 0
  if (showProgress) {
    if (book.progressPercentage !== null && book.progressPercentage !== undefined) {
      percentage = Math.min(100, Math.max(0, Math.round(book.progressPercentage)))
    } else if (book.pageCount && book.currentPage) {
      percentage = Math.min(
        100,
        Math.max(0, Math.round((book.currentPage / book.pageCount) * 100))
      )
    }
  }

  const rating = book.rating ?? 0

  return (
    <article
      onClick={() => onClick?.(book)}
      className={`group flex flex-col ${onClick ? 'cursor-pointer' : ''}`}
      data-testid="book-card"
    >
      {/* El libro, parado sobre el estante */}
      <div className="flex items-end justify-center px-3 pt-2">
        <div
          className="relative w-4/5 aspect-[2/3] overflow-hidden rounded-r-sm rounded-l-[2px] shadow-md transition-transform duration-200 group-hover:-translate-y-1"
          data-testid="book-cover"
        >
          {hasCover ? (
            <img
              src={coverUrl}
              alt={book.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
              data-testid="book-cover-image"
            />
          ) : (
            <div
              className={`relative w-full h-full flex items-center justify-center texture-paper text-brass ${TONE_CLASS[tone]}`}
              data-testid="book-cover-placeholder"
              data-cover-tone={tone}
            >
              <div
                aria-hidden="true"
                className="absolute inset-y-2.5 left-[16%] right-2.5 rounded-[1px] border-[3px] border-double border-brass/60"
                data-testid="book-cover-placeholder-frame"
              />
              <BookOpen className="relative w-1/4 h-auto stroke-[1.5]" aria-hidden="true" />
            </div>
          )}
          <div
            aria-hidden="true"
            className="book-hinge pointer-events-none absolute inset-y-0 left-0 w-[8%]"
          />
        </div>
      </div>

      <div
        className="shelf-plank"
        data-shelf-plank=""
        data-testid="shelf-plank"
        aria-hidden="true"
      />

      {/* Ficha de catálogo debajo del estante */}
      <div className="flex flex-1 px-3 pt-3">
        <div
          className="ficha flex flex-1 flex-col gap-2 rounded-sm p-3 transition-colors duration-200 group-hover:border-rule-strong"
          data-testid="book-ficha"
        >
          <div>
            <h3
              className="font-semibold text-ink text-sm line-clamp-2 leading-tight group-hover:text-accent transition-colors"
              title={book.title}
              data-testid="book-title"
            >
              {book.title}
            </h3>
            <p
              className="text-xs italic text-ink-muted line-clamp-1 mt-1"
              title={book.authors}
              data-testid="book-authors"
            >
              {book.authors}
            </p>
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-2 border-t border-dashed border-rule">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-semibold tracking-wide bg-card border ${statusConfig.badgeClass}`}
                data-testid="book-status-badge"
              >
                {statusConfig.label}
              </span>

              <div
                className="flex items-center gap-0.5"
                data-testid="book-rating"
                aria-label={`Calificación: ${rating > 0 ? `${rating} de 5 estrellas` : 'Sin calificar'}`}
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const isFilled = rating >= starValue
                  return (
                    <Star
                      key={starValue}
                      className={`w-3 h-3 ${
                        isFilled ? 'text-star fill-star' : 'text-ink-faint fill-transparent'
                      }`}
                      data-testid={`star-${starValue}${isFilled ? '-filled' : ''}`}
                    />
                  )
                })}
              </div>
            </div>

            {showProgress && (
              <div className="flex items-center gap-2" data-testid="book-progress">
                <div className="flex-1 bg-rule/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-ink select-none">{percentage}%</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
