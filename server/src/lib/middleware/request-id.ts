import { createMiddleware } from '../factory'

export const requestId = createMiddleware(async (c, next) => {
    const id = crypto.randomUUID()
    c.set('requestId', id)
    c.res.headers.set('X-Request-Id', id)
    await next()
})
