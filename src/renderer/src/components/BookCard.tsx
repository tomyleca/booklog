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
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30'
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  [BookStatus.FINISHED]: {
    label: 'Terminado',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  }
}

const STATUSES_WITH_PROGRESS: readonly BookStatus[] = [
  BookStatus.READING,
  BookStatus.PAUSED,
  BookStatus.ABANDONED
]

export function BookCard({ book, onClick }: BookCardProps): JSX.Element {
  const [imageError, setImageError] = useState(false)

  const coverUrl = resolveCoverUrl(book.coverPath, book.coverUrl ?? '')
  const hasCover = Boolean(coverUrl && !imageError)

  const statusConfig = STATUS_CONFIG[book.status] ?? {
    label: book.status,
    badgeClass: 'bg-slate-700 text-slate-300 border-slate-600'
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
      className={`group flex flex-col bg-slate-800/90 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      data-testid="book-card"
    >
      {/* Cover Image or Neutral Placeholder */}
      <div className="relative aspect-[2/3] w-full bg-slate-850 overflow-hidden flex items-center justify-center">
        {hasCover ? (
          <img
            src={coverUrl}
            alt={book.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid="book-cover-image"
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 text-slate-500"
            data-testid="book-cover-placeholder"
          >
            <BookOpen className="w-12 h-12 stroke-[1.5]" />
          </div>
        )}

        {/* Status Badge overlay at top right */}
        <div className="absolute top-2.5 right-2.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border backdrop-blur-xs ${statusConfig.badgeClass}`}
            data-testid="book-status-badge"
          >
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Book Metadata */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <h3
            className="font-semibold text-slate-100 text-sm line-clamp-2 leading-tight group-hover:text-indigo-300 transition-colors"
            title={book.title}
            data-testid="book-title"
          >
            {book.title}
          </h3>
          <p
            className="text-xs text-slate-400 line-clamp-1 mt-1"
            title={book.authors}
            data-testid="book-authors"
          >
            {book.authors}
          </p>
        </div>

        <div className="pt-1 border-t border-slate-700/40">
          {/* Progress bar with percentage only */}
          {showProgress && (
            <div className="flex items-center gap-2 mb-2" data-testid="book-progress">
              <div className="flex-1 bg-slate-750 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-xs font-mono text-slate-300 select-none">
                {percentage}%
              </span>
            </div>
          )}

          {/* Rating Stars */}
          <div
            className="flex items-center gap-1"
            data-testid="book-rating"
            aria-label={`Calificación: ${rating > 0 ? `${rating} de 5 estrellas` : 'Sin calificar'}`}
          >
            {[1, 2, 3, 4, 5].map((starValue) => {
              const isFilled = rating >= starValue
              return (
                <Star
                  key={starValue}
                  className={`w-3.5 h-3.5 ${
                    isFilled
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-600 fill-transparent'
                  }`}
                  data-testid={`star-${starValue}${isFilled ? '-filled' : ''}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </article>
  )
}
