import type {SSEStreamingApi} from 'hono/streaming'

export type SSEConnection = {
    stream: SSEStreamingApi
    aborted: boolean
}

const channels = new Map<string, Set<SSEConnection>>()

export function addConnection(channelId: string, conn: SSEConnection) {
    if (!channels.has(channelId)) channels.set(channelId, new Set())
    channels.get(channelId)!.add(conn)
}

export function removeConnection(channelId: string, conn: SSEConnection) {
    const set = channels.get(channelId)
    if (!set) return
    set.delete(conn)
    if (!set.size) channels.delete(channelId)
}

export function broadcast(channelId: string, event: string, data: unknown) {
    const msg = JSON.stringify(data)

    if (channelId === '*') {
        for (const set of channels.values()) {
            for (const conn of set) {
                if (conn.aborted) continue
                try {
                    conn.stream.writeSSE({event, data: msg})
                } catch {
                    conn.aborted = true
                }
            }
        }
        return
    }

    const set = channels.get(channelId)
    if (!set) return
    for (const conn of set) {
        if (conn.aborted) continue
        try {
            conn.stream.writeSSE({event, data: msg})
        } catch {
            conn.aborted = true
        }
    }
}
