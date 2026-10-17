import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  BookOpen,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
  PauseCircle,
  Bookmark,
  XCircle,
  ChevronRight,
  BookMarked
} from 'lucide-react'
import { bookService } from '../services/bookService.js'
import { resolveCoverUrl } from '../services/coverService.js'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'
import type { BookPrimitives } from '../../../shared/infrastructure/ipc/contracts.js'

export interface DashboardPageProps {
  onSelectBook?: (bookId: number) => void
}

export const STATUS_CONFIG: Record<
  BookStatus,
  { label: string; badgeClass: string; barClass: string; textClass: string; icon: typeof CheckCircle2 }
> = {
  [BookStatus.FINISHED]: {
    label: 'Terminado',
    badgeClass: 'bg-status-finished/10 text-status-finished border-status-finished/40',
    barClass: 'bg-status-finished',
    textClass: 'text-status-finished',
    icon: CheckCircle2
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    badgeClass: 'bg-status-reading/10 text-status-reading border-status-reading/40',
    barClass: 'bg-status-reading',
    textClass: 'text-status-reading',
    icon: Clock
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    badgeClass: 'bg-status-paused/10 text-status-paused border-status-paused/40',
    barClass: 'bg-status-paused',
    textClass: 'text-status-paused',
    icon: PauseCircle
  },
  [BookStatus.TO_READ]: {
    label: 'Por leer',
    badgeClass: 'bg-status-to-read/10 text-status-to-read border-status-to-read/40',
    barClass: 'bg-status-to-read',
    textClass: 'text-status-to-read',
    icon: Bookmark
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    badgeClass: 'bg-status-abandoned/10 text-status-abandoned border-status-abandoned/40',
    barClass: 'bg-status-abandoned',
    textClass: 'text-status-abandoned',
    icon: XCircle
  }
}

/**
 * Calculates total pages read for a book based on:
 * 1. If status is FINISHED and has pageCount, return pageCount.
 * 2. If currentPage is defined and > 0, return currentPage.
 * 3. If currentPage is not defined (or 0) but has progressPercentage and pageCount, calculate Math.round((progressPercentage / 100) * pageCount).
 * 4. Otherwise, return 0.
 */
export function calculateBookPagesRead(book: {
  status: BookStatus | string
  currentPage?: number | null
  progressPercentage?: number | null
  pageCount?: number | null
}): number {
  if (book.status === BookStatus.FINISHED && book.pageCount && book.pageCount > 0) {
    return book.pageCount
  }
  if (book.currentPage !== undefined && book.currentPage !== null && book.currentPage > 0) {
    return book.currentPage
  }
  if (
    book.progressPercentage !== undefined &&
    book.progressPercentage !== null &&
    book.progressPercentage > 0 &&
    book.pageCount &&
    book.pageCount > 0
  ) {
    return Math.round((book.progressPercentage / 100) * book.pageCount)
  }
  return 0
}

/**
 * Sorts books by updatedAt (or createdAt as fallback) descending and returns up to 5 books.
 */
export function sortRecentBooks(books: BookPrimitives[]): BookPrimitives[] {
  return [...books]
    .sort((a, b) => {
      const timeB = b.updatedAt
        ? new Date(b.updatedAt).getTime()
        : b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0
      const timeA = a.updatedAt
        ? new Date(a.updatedAt).getTime()
        : a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0
      return timeB - timeA
    })
    .slice(0, 5)
}

function RecentBookItem({
  book,
  onSelectBook
}: {
  book: BookPrimitives
  onSelectBook?: (bookId: number) => void
}): JSX.Element {
  const [imageError, setImageError] = useState(false)
  const coverUrl = resolveCoverUrl(book.coverPath, book.coverUrl ?? '')
  const hasCover = Boolean(coverUrl && !imageError)
  const statusCfg = STATUS_CONFIG[book.status] ?? {
    label: book.status,
    badgeClass: 'bg-shelf text-ink-muted border-rule-strong',
    barClass: 'bg-ink-faint',
    textClass: 'text-ink',
    icon: BookOpen
  }

  const progress =
    book.status === BookStatus.FINISHED
      ? 100
      : book.progressPercentage !== null && book.progressPercentage !== undefined
        ? Math.min(100, Math.max(0, Math.round(book.progressPercentage)))
        : book.pageCount && book.currentPage
          ? Math.min(100, Math.max(0, Math.round((book.currentPage / book.pageCount) * 100)))
          : 0

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="recent-book-item"
      data-book-id={book.id}
      onClick={() => {
        if (book.id !== undefined && onSelectBook) {
          onSelectBook(book.id)
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && book.id !== undefined && onSelectBook) {
          e.preventDefault()
          onSelectBook(book.id)
        }
      }}
      className="flex items-center justify-between p-3.5 rounded-md bg-card/40 hover:bg-shelf/80 border border-rule/50 hover:border-rule-strong transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-14 shrink-0 rounded bg-shelf border border-rule/60 overflow-hidden flex items-center justify-center">
          {hasCover ? (
            <img
              src={coverUrl}
              alt={book.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="w-4 h-4 text-ink-faint" />
          )}
        </div>
        <div className="min-w-0">
          <h4
            className="text-sm font-semibold text-ink group-hover:text-accent truncate transition-colors"
            data-testid="recent-book-title"
          >
            {book.title}
          </h4>
          <p className="text-xs text-ink-muted truncate mt-0.5" data-testid="recent-book-author">
            {book.authors || 'Autor desconocido'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${statusCfg.badgeClass}`}
          data-testid="recent-book-status"
        >
          {statusCfg.label}
        </span>
        <div className="hidden sm:flex flex-col items-end w-24" data-testid="recent-book-progress">
          <span className="text-xs font-medium text-ink">{progress}%</span>
          <div className="w-full h-1.5 bg-well border border-rule/60 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full ${statusCfg.barClass} rounded-full transition-all`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink transition-colors" />
      </div>
    </div>
  )
}

export function DashboardPage({ onSelectBook }: DashboardPageProps = {}): JSX.Element {
  const {
    data: books,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useQuery<BookPrimitives[], Error>({
    queryKey: ['books'],
    queryFn: async () => {
      const res = await bookService.list()
      if (!res.success) {
        throw new Error(res.error || 'No se pudieron cargar las estadísticas')
      }
      return res.data
    }
  })

  // Calculations
  const stats = useMemo(() => {
    if (!books || books.length === 0) {
      return {
        totalBooks: 0,
        finishedCount: 0,
        readingCount: 0,
        pausedCount: 0,
        toReadCount: 0,
        abandonedCount: 0,
        totalPagesRead: 0,
        recentBooks: []
      }
    }

    let finished = 0
    let reading = 0
    let paused = 0
    let toRead = 0
    let abandoned = 0
    let totalPages = 0

    for (const book of books) {
      switch (book.status) {
        case BookStatus.FINISHED:
          finished++
          break
        case BookStatus.READING:
          reading++
          break
        case BookStatus.PAUSED:
          paused++
          break
        case BookStatus.TO_READ:
          toRead++
          break
        case BookStatus.ABANDONED:
          abandoned++
          break
      }

      totalPages += calculateBookPagesRead(book)
    }

    const recent = sortRecentBooks(books)

    return {
      totalBooks: books.length,
      finishedCount: finished,
      readingCount: reading,
      pausedCount: paused,
      toReadCount: toRead,
      abandonedCount: abandoned,
      totalPagesRead: totalPages,
      recentBooks: recent
    }
  }, [books])

  const orderedStatuses: BookStatus[] = [
    BookStatus.FINISHED,
    BookStatus.READING,
    BookStatus.PAUSED,
    BookStatus.TO_READ,
    BookStatus.ABANDONED
  ]

  const statusCounts: Record<BookStatus, number> = {
    [BookStatus.FINISHED]: stats.finishedCount,
    [BookStatus.READING]: stats.readingCount,
    [BookStatus.PAUSED]: stats.pausedCount,
    [BookStatus.TO_READ]: stats.toReadCount,
    [BookStatus.ABANDONED]: stats.abandonedCount
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="dashboard-page">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 rule-double">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-md bg-leather texture-wood text-brass border border-backdrop/30 shadow-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink" data-testid="dashboard-title">
                Dashboard de Lectura
              </h1>
              <p className="text-sm text-ink-muted mt-0.5">
                Métricas analíticas y resumen de tus hábitos de lectura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-ink bg-shelf hover:bg-rule/80 border border-rule/60 transition-colors disabled:opacity-50"
              title="Actualizar estadísticas"
              data-testid="refresh-button"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {isLoading && (
          <div
            className="flex flex-col items-center justify-center py-24 text-ink-muted gap-3"
            data-testid="loading-state"
          >
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando estadísticas...</p>
          </div>
        )}

        {isError && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center rounded-md border border-danger/30 bg-danger/10 p-8 my-6"
            data-testid="error-state"
          >
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-3 border border-danger/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-ink">Error al cargar las estadísticas</h3>
            <p className="text-sm text-ink-muted max-w-md mt-1 mb-4" data-testid="error-message">
              {error?.message || 'Error desconocido'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent hover:bg-accent-strong text-accent-ink text-xs font-medium transition-colors shadow-sm"
              data-testid="retry-button"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        )}

        {!isLoading && !isError && books && (
          <>
            {books.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-md border border-2 border-dashed border-rule-strong/70 bg-card/50 texture-paper"
                data-testid="empty-dashboard-state"
              >
                <div className="w-14 h-14 rounded-md bg-card/70 border border-rule/50 flex items-center justify-center text-ink-muted mb-4">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-semibold text-ink">Aún no hay estadísticas disponibles</h2>
                <p className="text-sm text-ink-muted max-w-md mt-1">
                  Agrega libros a tu biblioteca para comenzar a ver métricas, páginas leídas y desglose de estados.
                </p>
              </div>
            ) : (
              <div className="space-y-8" data-testid="dashboard-content">
                {/* Highlighted KPIs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpis-grid">
                  {/* Total Pages Read */}
                  <div
                    className="col-span-2 sm:col-span-3 lg:col-span-2 p-5 rounded-md ficha relative overflow-hidden"
                    data-testid="kpi-total-pages"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">
                        Páginas Totales Leídas
                      </span>
                      <div className="p-2 rounded-md bg-accent/10 text-accent">
                        <BookMarked className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-display font-bold tracking-tight text-ink" data-testid="stat-total-pages">
                        {stats.totalPagesRead.toLocaleString()}
                      </span>
                      <span className="text-xs text-ink-muted">páginas</span>
                    </div>
                    <p className="text-[11px] text-ink-faint mt-2">
                      Calculado sobre el progreso de {stats.totalBooks} {stats.totalBooks === 1 ? 'libro' : 'libros'}
                    </p>
                  </div>

                  {/* Finished Books */}
                  <div
                    className="p-5 rounded-md ficha flex flex-col justify-between"
                    data-testid="kpi-finished"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">Terminados</span>
                      <CheckCircle2 className="w-4 h-4 text-status-finished" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-display font-bold text-status-finished" data-testid="stat-finished-count">
                        {stats.finishedCount}
                      </span>
                    </div>
                  </div>

                  {/* Reading Books */}
                  <div
                    className="p-5 rounded-md ficha flex flex-col justify-between"
                    data-testid="kpi-reading"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">Leyendo</span>
                      <Clock className="w-4 h-4 text-status-reading" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-display font-bold text-status-reading" data-testid="stat-reading-count">
                        {stats.readingCount}
                      </span>
                    </div>
                  </div>

                  {/* Paused Books */}
                  <div
                    className="p-5 rounded-md ficha flex flex-col justify-between"
                    data-testid="kpi-paused"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">Pausados</span>
                      <PauseCircle className="w-4 h-4 text-status-paused" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-display font-bold text-status-paused" data-testid="stat-paused-count">
                        {stats.pausedCount}
                      </span>
                    </div>
                  </div>

                  {/* To Read & Abandoned Books */}
                  <div
                    className="p-5 rounded-md ficha flex flex-col justify-between"
                    data-testid="kpi-to-read"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-ink-muted">Por leer / Abandonados</span>
                      <Bookmark className="w-4 h-4 text-status-to-read" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-display font-bold text-status-to-read" data-testid="stat-to-read-count">
                        {stats.toReadCount}
                      </span>
                      <span className="text-xs text-ink-faint">/</span>
                      <span className="text-base font-display font-semibold text-status-abandoned" data-testid="stat-abandoned-count">
                        {stats.abandonedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Breakdown Section */}
                <section
                  className="p-6 rounded-md ficha"
                  data-testid="status-breakdown"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-ink">Desglose de libros por estado</h3>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Proporción y distribución de {stats.totalBooks} {stats.totalBooks === 1 ? 'libro registrado' : 'libros registrados'}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-ink-muted" data-testid="stat-total-books">
                      Total: {stats.totalBooks}
                    </span>
                  </div>

                  {/* Visual Distribution Bar */}
                  <div
                    className="h-3 w-full bg-shelf rounded-full overflow-hidden flex shadow-inner mb-6"
                    data-testid="distribution-bar"
                  >
                    {orderedStatuses.map((st) => {
                      const count = statusCounts[st]
                      if (count === 0) return null
                      const pct = (count / stats.totalBooks) * 100
                      const cfg = STATUS_CONFIG[st]
                      return (
                        <div
                          key={st}
                          className={`${cfg.barClass} h-full transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${cfg.label}: ${count} (${Math.round(pct)}%)`}
                          data-testid={`distribution-segment-${st}`}
                        />
                      )
                    })}
                  </div>

                  {/* Distribution Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="status-breakdown-cards">
                    {orderedStatuses.map((st) => {
                      const count = statusCounts[st]
                      const pct = stats.totalBooks > 0 ? Math.round((count / stats.totalBooks) * 100) : 0
                      const cfg = STATUS_CONFIG[st]
                      const IconComponent = cfg.icon

                      return (
                        <div
                          key={st}
                          className="p-3 rounded-md bg-card/60 border border-rule flex flex-col justify-between"
                          data-testid={`status-card-${st}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-ink">{cfg.label}</span>
                            <IconComponent className={`w-3.5 h-3.5 ${cfg.textClass}`} />
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-ink">{count}</span>
                            <span className="text-xs text-ink-muted">{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Recent Books Section */}
                <section
                  className="p-6 rounded-md ficha"
                  data-testid="recent-books-section"
                >
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-ink">Libros recientes</h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Últimos libros leídos o actualizados en tu biblioteca
                    </p>
                  </div>

                  <div className="space-y-2.5" data-testid="recent-books-list">
                    {stats.recentBooks.map((book) => (
                      <RecentBookItem
                        key={book.id ?? book.title}
                        book={book}
                        onSelectBook={onSelectBook}
                      />
                    ))}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
