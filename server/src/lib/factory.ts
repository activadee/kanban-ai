/**
 * Hono factory helpers for type-safe middleware and handlers.
 *
 * Usage:
 *   import { createMiddleware, createHandlers } from '../lib/factory'
 *
 *   const myMiddleware = createMiddleware(async (c, next) => {
 *     // c is properly typed as Context<AppEnv>
 *     await next()
 *   })
 *
 *   const handlers = createHandlers(
 *     (c) => c.json({ ok: true })
 *   )
 */
import { createFactory } from 'hono/factory'
import type { AppEnv } from '../env'

const factory = createFactory<AppEnv>()

/**
 * Create a typed middleware function.
 * The context `c` will have full type inference for c.get(), c.set(), etc.
 */
export const createMiddleware = factory.createMiddleware

/**
 * Create typed handler(s) for a route.
 * Can be used to create a single handler or multiple middleware + handler.
 */
export const createHandlers = factory.createHandlers
