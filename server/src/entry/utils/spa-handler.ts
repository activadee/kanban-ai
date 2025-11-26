import path from 'node:path'
import { staticBundle } from '../../static-bundle.generated'
import { runtimeEnv } from '../../env'

const resolveStaticBase = (explicit?: string): string => {
  if (explicit && explicit.trim().length > 0) return explicit.trim()

  const fromEnv = runtimeEnv().KANBANAI_STATIC_DIR
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim()

  // Logical root used when we also want to serve from disk (dev / overrides).
  return 'server/static'
}

const guessContentType = (pathname: string): string => {
  if (pathname.endsWith('.html') || pathname === '/' || pathname === '/index.html') return 'text/html; charset=utf-8'
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
  if (pathname.endsWith('.svg')) return 'image/svg+xml'
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

const tryServeStaticFromBundle = (pathname: string): Response | null => {
  const key = pathname === '' ? '/' : pathname
  let effectiveKey = key
  let body = staticBundle[key]

  // SPA fallback: any non-asset path (no file extension) that isn't explicitly
  // in the bundle should return the index.html shell so deep links work.
  if (body === undefined) {
    const lastSegment = key.split('/').pop() ?? ''
    const hasExtension = lastSegment.includes('.')
    if (!hasExtension) {
      body = staticBundle['/'] ?? staticBundle['/index.html']
      effectiveKey = '/'
    }
  }

  if (body === undefined) return null

  return new Response(body, {
    headers: {
      'Content-Type': guessContentType(effectiveKey),
    },
  })
}

const tryServeStaticFromFs = async (request: Request, staticBase: string): Promise<Response | null> => {
  const url = new URL(request.url)
  const pathname = url.pathname === '/' || url.pathname === '' ? '/index.html' : url.pathname
  const fsPath = path.join(staticBase, pathname.replace(/^[/\\]+/, ''))
  const file = Bun.file(fsPath)

  if (await file.exists()) {
    return new Response(file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    })
  }

  return null
}

export type StaticHandler = (request: Request) => Promise<Response | null>

export const createStaticHandler = (staticDir?: string): StaticHandler => {
  const staticBase = resolveStaticBase(staticDir)

  return async (request) => {
    const url = new URL(request.url)
    const pathname = url.pathname || '/'

    const bundled = tryServeStaticFromBundle(pathname)
    if (bundled) return bundled

    return tryServeStaticFromFs(request, staticBase)
  }
}
