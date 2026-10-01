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
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    barClass: 'bg-indigo-500',
    textClass: 'text-indigo-400',
    icon: CheckCircle2
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    barClass: 'bg-emerald-500',
    textClass: 'text-emerald-400',
    icon: Clock
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    barClass: 'bg-amber-500',
    textClass: 'text-amber-400',
    icon: PauseCircle
  },
  [BookStatus.TO_READ]: {
    label: 'Por leer',
    badgeClass: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    barClass: 'bg-sky-500',
    textClass: 'text-sky-400',
    icon: Bookmark
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    barClass: 'bg-rose-500',
    textClass: 'text-rose-400',
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
    badgeClass: 'bg-slate-700 text-slate-300 border-slate-600',
    barClass: 'bg-slate-500',
    textClass: 'text-slate-300',
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
      className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 hover:border-slate-600 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-14 shrink-0 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center">
          {hasCover ? (
            <img
              src={coverUrl}
              alt={book.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="w-4 h-4 text-slate-500" />
          )}
        </div>
        <div className="min-w-0">
          <h4
            className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300 truncate transition-colors"
            data-testid="recent-book-title"
          >
            {book.title}
          </h4>
          <p className="text-xs text-slate-400 truncate mt-0.5" data-testid="recent-book-author">
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
          <span className="text-xs font-medium text-slate-300">{progress}%</span>
          <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full ${statusCfg.barClass} rounded-full transition-all`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-xs">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100" data-testid="dashboard-title">
                Dashboard de Lectura
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Métricas analíticas y resumen de tus hábitos de lectura
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 transition-colors disabled:opacity-50"
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
            className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3"
            data-testid="loading-state"
          >
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando estadísticas...</p>
          </div>
        )}

        {isError && (
          <div
            className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-rose-900/30 bg-rose-950/10 p-8 my-6"
            data-testid="error-state"
          >
            <div className="w-12 h-12 rounded-full bg-rose-950/50 text-rose-400 flex items-center justify-center mb-3 border border-rose-800/40">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Error al cargar las estadísticas</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1 mb-4" data-testid="error-message">
              {error?.message || 'Error desconocido'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
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
                className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40"
                data-testid="empty-dashboard-state"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-slate-400 mb-4">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-semibold text-slate-200">Aún no hay estadísticas disponibles</h2>
                <p className="text-sm text-slate-400 max-w-md mt-1">
                  Agrega libros a tu biblioteca para comenzar a ver métricas, páginas leídas y desglose de estados.
                </p>
              </div>
            ) : (
              <div className="space-y-8" data-testid="dashboard-content">
                {/* Highlighted KPIs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="kpis-grid">
                  {/* Total Pages Read */}
                  <div
                    className="col-span-2 sm:col-span-3 lg:col-span-2 p-5 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm relative overflow-hidden"
                    data-testid="kpi-total-pages"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Páginas Totales Leídas
                      </span>
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <BookMarked className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-white" data-testid="stat-total-pages">
                        {stats.totalPagesRead.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400">páginas</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2">
                      Calculado sobre el progreso de {stats.totalBooks} {stats.totalBooks === 1 ? 'libro' : 'libros'}
                    </p>
                  </div>

                  {/* Finished Books */}
                  <div
                    className="p-5 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm flex flex-col justify-between"
                    data-testid="kpi-finished"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Terminados</span>
                      <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-indigo-400" data-testid="stat-finished-count">
                        {stats.finishedCount}
                      </span>
                    </div>
                  </div>

                  {/* Reading Books */}
                  <div
                    className="p-5 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm flex flex-col justify-between"
                    data-testid="kpi-reading"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Leyendo</span>
                      <Clock className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-emerald-400" data-testid="stat-reading-count">
                        {stats.readingCount}
                      </span>
                    </div>
                  </div>

                  {/* Paused Books */}
                  <div
                    className="p-5 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm flex flex-col justify-between"
                    data-testid="kpi-paused"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Pausados</span>
                      <PauseCircle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-amber-400" data-testid="stat-paused-count">
                        {stats.pausedCount}
                      </span>
                    </div>
                  </div>

                  {/* To Read & Abandoned Books */}
                  <div
                    className="p-5 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm flex flex-col justify-between"
                    data-testid="kpi-to-read"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Por leer / Abandonados</span>
                      <Bookmark className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-sky-400" data-testid="stat-to-read-count">
                        {stats.toReadCount}
                      </span>
                      <span className="text-xs text-slate-500">/</span>
                      <span className="text-base font-semibold text-rose-400" data-testid="stat-abandoned-count">
                        {stats.abandonedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Breakdown Section */}
                <section
                  className="p-6 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm"
                  data-testid="status-breakdown"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-200">Desglose de libros por estado</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Proporción y distribución de {stats.totalBooks} {stats.totalBooks === 1 ? 'libro registrado' : 'libros registrados'}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-400" data-testid="stat-total-books">
                      Total: {stats.totalBooks}
                    </span>
                  </div>

                  {/* Visual Distribution Bar */}
                  <div
                    className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner mb-6"
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
                          className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 flex flex-col justify-between"
                          data-testid={`status-card-${st}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-slate-300">{cfg.label}</span>
                            <IconComponent className={`w-3.5 h-3.5 ${cfg.textClass}`} />
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-lg font-bold text-slate-100">{count}</span>
                            <span className="text-xs text-slate-400">{pct}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* Recent Books Section */}
                <section
                  className="p-6 rounded-2xl bg-slate-850/80 border border-slate-800/90 shadow-sm"
                  data-testid="recent-books-section"
                >
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-200">Libros recientes</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
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
