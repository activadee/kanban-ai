import {adapters} from './adapters'
import type {EditorAdapter, EditorInfo, EditorKey} from './types'

export function detectEditors(): EditorInfo[] {
    return adapters.map((adapter) => adapter.detect())
}

export function getAdapterForKey(key: EditorKey | undefined): EditorAdapter {
    const adapter = adapters.find((entry) => entry.key === key)
    if (adapter) return adapter
    if (!adapters.length) {
        throw new Error('No editor adapters registered')
    }
    return adapters[0]!
}

