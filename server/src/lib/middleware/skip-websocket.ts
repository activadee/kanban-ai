import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../../env'

const isApiWebSocket = (path: string) =>
    path.startsWith('/api/ws') || path.startsWith('/api/v1/ws')

export const skipForWebSocket = (handler: MiddlewareHandler<AppEnv>): MiddlewareHandler<AppEnv> => {
    return (c, next) => {
        if (isApiWebSocket(c.req.path)) return next()
        return handler(c, next)
    }
}
