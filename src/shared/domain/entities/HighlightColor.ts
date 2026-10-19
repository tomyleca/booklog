/**
 * Color de un subrayado (feature #26). La exportación del Cuaderno de la app de Kindle lo
 * indica con la clase `highlight_<color>`; `My Clippings.txt` no lo trae, así que los
 * subrayados importados de ahí quedan sin color (`null`).
 */
export const HighlightColor = {
  YELLOW: 'YELLOW',
  BLUE: 'BLUE',
  PINK: 'PINK',
  ORANGE: 'ORANGE'
} as const

export type HighlightColor = (typeof HighlightColor)[keyof typeof HighlightColor]

export const ALL_HIGHLIGHT_COLORS: readonly HighlightColor[] = Object.values(HighlightColor)

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && ALL_HIGHLIGHT_COLORS.includes(value as HighlightColor)
}
