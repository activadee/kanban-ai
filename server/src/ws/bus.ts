import type {WSContext} from 'hono/ws'

type Msg = string

const channels = new Map<string, Set<WSContext>>()

export function addSocket(projectId: string, ws: WSContext) {
    if (!channels.has(projectId)) channels.set(projectId, new Set())
    channels.get(projectId)!.add(ws)
}

export function removeSocket(projectId: string, ws: WSContext) {
    const set = channels.get(projectId)
    if (!set) return
    set.delete(ws)
    if (!set.size) channels.delete(projectId)
}

export function broadcast(projectId: string, msg: Msg) {
    if (projectId === '*') {
        for (const set of channels.values()) {
            for (const ws of set) {
                try {
                    ws.send(msg)
                } catch {
                }
            }
        }
        return
    }
    const set = channels.get(projectId)
    if (!set) return
    for (const ws of set) {
        try {
            ws.send(msg)
        } catch {
        }
    }
}
