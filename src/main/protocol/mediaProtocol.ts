import { app, protocol, net } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MEDIA_PROTOCOL_SCHEME = 'booklog-media'

/**
 * Registers the custom scheme as privileged.
 * MUST be called before app.whenReady().
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_PROTOCOL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

/**
 * Registers the custom protocol handler to securely serve media files from Electron's userData directory.
 * MUST be called after app.whenReady().
 */
export function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_PROTOCOL_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      // Extract the relative path regardless of whether host is 'covers' or empty
      const relativePart = url.host
        ? `${url.host}${url.pathname}`
        : url.pathname.replace(/^\/+/, '')

      const decoded = decodeURIComponent(relativePart)
      const cleanPath = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '')

      const userDataPath = app.getPath('userData')
      const targetPath = path.resolve(userDataPath, cleanPath)

      // Strict security barrier: target must strictly be within userData
      if (!targetPath.startsWith(path.resolve(userDataPath))) {
        return new Response('Forbidden', { status: 403 })
      }

      if (!fs.existsSync(targetPath)) {
        return new Response('Not Found', { status: 404 })
      }

      const stat = await fs.promises.stat(targetPath)
      if (!stat.isFile()) {
        return new Response('Not Found', { status: 404 })
      }

      return await net.fetch(pathToFileURL(targetPath).toString())
    } catch {
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}
