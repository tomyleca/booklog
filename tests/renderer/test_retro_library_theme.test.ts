import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve(__dirname, '../..')
const RENDERER_SRC = join(ROOT, 'src/renderer/src')
const MAIN_CSS = readFileSync(join(RENDERER_SRC, 'assets/main.css'), 'utf-8')

function listFiles(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return listFiles(full, ext)
    return full.endsWith(ext) ? [full] : []
  })
}

const TSX_FILES = listFiles(RENDERER_SRC, '.tsx')

function extractBlock(css: string, header: RegExp): string {
  const match = header.exec(css)
  if (!match) return ''
  const start = css.indexOf('{', match.index) + 1
  let depth = 1
  let i = start
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    i++
  }
  return css.slice(start, i - 1)
}

function parseColorVars(block: string): Map<string, string> {
  const vars = new Map<string, string>()
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    vars.set(m[1] as string, (m[2] as string).toLowerCase())
  }
  return vars
}

const THEME_BLOCK = extractBlock(MAIN_CSS, /@theme\s*\{/)
const DARK_BLOCK = extractBlock(MAIN_CSS, /\n\s*\.dark\s*\{/)
const LIGHT_TOKENS = parseColorVars(THEME_BLOCK)
const DARK_TOKENS = parseColorVars(DARK_BLOCK)

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const RAW_PALETTE =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|fill|stroke|from|via|to|placeholder|divide|outline|shadow|decoration|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
const RAW_BW = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|fill|placeholder)-(?:white|black)\b/

describe('Feature #16 — retro library theme', () => {
  describe('Design tokens in main.css', () => {
    const REQUIRED_TOKENS = [
      'paper',
      'card',
      'well',
      'shelf',
      'chrome',
      'ink',
      'ink-muted',
      'ink-faint',
      'rule',
      'rule-strong',
      'accent',
      'accent-ink',
      'leather',
      'spine',
      'brass',
      'danger',
      'success',
      'star',
      'status-to-read',
      'status-reading',
      'status-paused',
      'status-finished',
      'status-abandoned'
    ]

    it('should declare the semantic color tokens inside @theme', () => {
      expect(THEME_BLOCK).not.toBe('')
      for (const token of REQUIRED_TOKENS) {
        expect(LIGHT_TOKENS.has(token), `missing --color-${token} in @theme`).toBe(true)
      }
    })

    it('should override every color token under the .dark class', () => {
      expect(DARK_BLOCK).not.toBe('')
      for (const token of LIGHT_TOKENS.keys()) {
        expect(DARK_TOKENS.has(token), `missing --color-${token} in .dark`).toBe(true)
        expect(DARK_TOKENS.get(token)).not.toBe(LIGHT_TOKENS.get(token))
      }
    })

    it('should keep the class-based dark variant used by the theme selector', () => {
      expect(MAIN_CSS).toContain('@custom-variant dark (&:where(.dark, .dark *));')
    })

    it.each([
      ['light', LIGHT_TOKENS],
      ['dark', DARK_TOKENS]
    ])('should meet WCAG AA (4.5:1) for main text in the %s theme', (_name, tokens) => {
      const pairs: Array<[string, string]> = [
        ['ink', 'paper'],
        ['ink', 'card'],
        ['ink', 'well'],
        ['ink-muted', 'paper'],
        ['ink-muted', 'card'],
        ['ink-faint', 'card'],
        ['accent', 'paper'],
        ['accent', 'card'],
        ['accent-ink', 'accent'],
        ['chrome-ink', 'chrome'],
        ['danger', 'card'],
        ['status-to-read', 'card'],
        ['status-reading', 'card'],
        ['status-paused', 'card'],
        ['status-finished', 'card'],
        ['status-abandoned', 'card']
      ]
      for (const [fg, bg] of pairs) {
        const ratio = contrast(tokens.get(fg) as string, tokens.get(bg) as string)
        expect(ratio, `${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('should keep the five reading status colors distinct from each other', () => {
      for (const tokens of [LIGHT_TOKENS, DARK_TOKENS]) {
        const statusColors = [
          'status-to-read',
          'status-reading',
          'status-paused',
          'status-finished',
          'status-abandoned'
        ].map((t) => tokens.get(t))
        expect(new Set(statusColors).size).toBe(5)
      }
    })
  })

  describe('Textures', () => {
    it('should define paper and wood textures as inline SVG data URIs', () => {
      expect(MAIN_CSS).toMatch(/@utility texture-paper\s*\{/)
      expect(MAIN_CSS).toMatch(/@utility texture-wood\s*\{/)
      expect(MAIN_CSS).toMatch(/--texture-paper:\s*url\("data:image\/svg\+xml/)
      expect(MAIN_CSS).toMatch(/--texture-wood:\s*url\("data:image\/svg\+xml/)
    })

    it('should define the catalog card (ficha) and double rule utilities', () => {
      expect(MAIN_CSS).toMatch(/@utility ficha\s*\{/)
      expect(MAIN_CSS).toMatch(/@utility rule-double\s*\{[^}]*double/)
    })

    it('should not load any remote asset (works offline)', () => {
      const withoutSvgNamespace = MAIN_CSS.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')
      expect(withoutSvgNamespace).not.toMatch(/https?:\/\//)
      expect(MAIN_CSS).not.toContain('fonts.googleapis')
    })
  })

  describe('Serif typography bundled with @fontsource', () => {
    const MAIN_TSX = readFileSync(join(RENDERER_SRC, 'main.tsx'), 'utf-8')
    const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>
    }

    it('should depend on the @fontsource packages', () => {
      expect(PACKAGE_JSON.dependencies['@fontsource-variable/lora']).toBeDefined()
      expect(PACKAGE_JSON.dependencies['@fontsource/libre-baskerville']).toBeDefined()
    })

    it('should import the font faces in the renderer entry point', () => {
      expect(MAIN_TSX).toMatch(/import '@fontsource-variable\/lora\/wght\.css'/)
      expect(MAIN_TSX).toMatch(/import '@fontsource\/libre-baskerville\/latin-400\.css'/)
      expect(MAIN_TSX).toMatch(/import '@fontsource\/libre-baskerville\/latin-700\.css'/)
    })

    it('should use the serif families for body text and headings', () => {
      expect(THEME_BLOCK).toMatch(/--font-serif:\s*"Lora Variable"/)
      expect(THEME_BLOCK).toMatch(/--font-display:\s*"Libre Baskerville"/)
      expect(MAIN_CSS).toMatch(/html\s*\{[^}]*font-family:\s*var\(--font-serif\)/)
      expect(MAIN_CSS).toMatch(/h1,\s*h2,\s*h3,\s*h4\s*\{[^}]*font-family:\s*var\(--font-display\)/)
    })

    it('should allow bundled fonts in the Content-Security-Policy', () => {
      const html = readFileSync(join(ROOT, 'src/renderer/index.html'), 'utf-8')
      expect(html).toMatch(/font-src 'self' data:/)
    })
  })

  describe('Components use tokens only', () => {
    it('should find renderer components to scan', () => {
      expect(TSX_FILES.length).toBeGreaterThan(10)
    })

    it.each(TSX_FILES.map((f) => [f.slice(RENDERER_SRC.length + 1), f]))(
      '%s should not use raw Tailwind palette colors',
      (_name, file) => {
        const source = readFileSync(file as string, 'utf-8')
        expect(source).not.toMatch(RAW_PALETTE)
        expect(source).not.toMatch(RAW_BW)
      }
    )

    it.each(TSX_FILES.map((f) => [f.slice(RENDERER_SRC.length + 1), f]))(
      '%s should not need dark: variants',
      (_name, file) => {
        const source = readFileSync(file as string, 'utf-8')
        expect(source).not.toMatch(/(?<![\w-])dark:/)
      }
    )

    it('should only reference color tokens that exist in @theme', () => {
      const NON_COLOR = new Set([
        'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', 'left', 'center', 'right',
        't', 'b', 'l', 'r', 'x', 'y', '2', '4', 'dashed', 'double', 'transparent',
        'current', 'none', 'cover', 'inset', 'hidden'
      ])
      const used = new Set<string>()
      const classPattern =
        /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border(?:-[tblrxy])?|ring|fill|accent)-([a-z][a-z-]*?)(?:\/\d+)?(?=[\s'"`}]|$)/g
      for (const file of TSX_FILES) {
        const source = readFileSync(file, 'utf-8')
        for (const m of source.matchAll(classPattern)) {
          const name = m[1] as string
          if (!NON_COLOR.has(name) && !/^\[/.test(name)) used.add(name)
        }
      }
      expect(used.size).toBeGreaterThan(10)
      for (const name of used) {
        expect(LIGHT_TOKENS.has(name), `unknown color token "${name}"`).toBe(true)
      }
    })
  })
})
