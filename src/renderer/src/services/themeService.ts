import type { AppTheme } from '../../../shared/infrastructure/ipc/contracts.js'

export const themeService = {
  applyTheme(theme: AppTheme): void {
    if (typeof document === 'undefined' || !document.documentElement) {
      return
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      // 'system'
      const prefersDark =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches

      if (prefersDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  },

  setupSystemThemeListener(theme: AppTheme, onChange?: (isDark: boolean) => void): () => void {
    if (
      theme !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return () => {}
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent): void => {
      if (typeof document !== 'undefined' && document.documentElement) {
        if (event.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
      onChange?.(event.matches)
    }

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    } else if ('addListener' in mediaQuery && typeof (mediaQuery as unknown as { addListener: (cb: typeof handler) => void }).addListener === 'function') {
      // Legacy fallback for older environments
      (mediaQuery as unknown as { addListener: (cb: typeof handler) => void }).addListener(handler)
      return () =>
        (mediaQuery as unknown as { removeListener: (cb: typeof handler) => void }).removeListener(handler)
    }

    return () => {}
  }
}
