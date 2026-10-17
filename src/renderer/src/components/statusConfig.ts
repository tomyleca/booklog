import { BookOpen, Bookmark, CheckCircle2, Clock, PauseCircle, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BookStatus } from '../../../shared/domain/entities/BookStatus.js'

export interface StatusStyle {
  label: string
  /** Badge sólido sobre la ficha de la estantería (fondo `bg-card` lo pone BookCard). */
  shelfBadgeClass: string
  /** Badge translúcido (`status/10`) usado en el detalle y en el dashboard. */
  badgeClass: string
  barClass: string
  textClass: string
  icon: LucideIcon
}

export const STATUS_ORDER: readonly BookStatus[] = [
  BookStatus.TO_READ,
  BookStatus.READING,
  BookStatus.PAUSED,
  BookStatus.FINISHED,
  BookStatus.ABANDONED
]

// Las clases van escritas completas (no interpoladas) para que Tailwind las detecte al escanear.
export const STATUS_CONFIG: Readonly<Record<BookStatus, StatusStyle>> = {
  [BookStatus.TO_READ]: {
    label: 'Por leer',
    shelfBadgeClass: 'text-status-to-read border-status-to-read/50',
    badgeClass: 'bg-status-to-read/10 text-status-to-read border-status-to-read/40',
    barClass: 'bg-status-to-read',
    textClass: 'text-status-to-read',
    icon: Bookmark
  },
  [BookStatus.READING]: {
    label: 'Leyendo',
    shelfBadgeClass: 'text-status-reading border-status-reading/50',
    badgeClass: 'bg-status-reading/10 text-status-reading border-status-reading/40',
    barClass: 'bg-status-reading',
    textClass: 'text-status-reading',
    icon: Clock
  },
  [BookStatus.PAUSED]: {
    label: 'Pausado',
    shelfBadgeClass: 'text-status-paused border-status-paused/50',
    badgeClass: 'bg-status-paused/10 text-status-paused border-status-paused/40',
    barClass: 'bg-status-paused',
    textClass: 'text-status-paused',
    icon: PauseCircle
  },
  [BookStatus.FINISHED]: {
    label: 'Terminado',
    shelfBadgeClass: 'text-status-finished border-status-finished/50',
    badgeClass: 'bg-status-finished/10 text-status-finished border-status-finished/40',
    barClass: 'bg-status-finished',
    textClass: 'text-status-finished',
    icon: CheckCircle2
  },
  [BookStatus.ABANDONED]: {
    label: 'Abandonado',
    shelfBadgeClass: 'text-status-abandoned border-status-abandoned/50',
    badgeClass: 'bg-status-abandoned/10 text-status-abandoned border-status-abandoned/40',
    barClass: 'bg-status-abandoned',
    textClass: 'text-status-abandoned',
    icon: XCircle
  }
}

/** Devuelve el estilo del estado, con un fallback neutro si llega un valor desconocido. */
export function getStatusConfig(status: string): StatusStyle {
  return (
    STATUS_CONFIG[status as BookStatus] ?? {
      label: status,
      shelfBadgeClass: 'text-ink-muted border-rule-strong',
      badgeClass: 'bg-shelf text-ink-muted border-rule-strong',
      barClass: 'bg-ink-faint',
      textClass: 'text-ink',
      icon: BookOpen
    }
  )
}
