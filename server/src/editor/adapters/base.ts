import {pickBinary} from '../bin'
import {normalizePathForWindowsBinary} from '../wsl'
import type {EditorAdapter, EditorInfo, ExecSpec} from '../types'

function formatCommandLine(cmd: string, args: string[]): string {
    const parts = [cmd, ...args]
    return parts
        .map((part) => {
            if (part.length === 0) return '""'
            if (/\s|"|\\/.test(part)) {
                return JSON.stringify(part)
            }
            return part
        })
        .join(' ')
}

export function createAdapter(params: {
    key: EditorAdapter['key']
    label: string
    candidates: () => string[]
    argsFor: (path: string, bin: string) => string[]
}): EditorAdapter {
    const {key, label, candidates, argsFor} = params

    const pick = (): string | null => pickBinary(candidates())

    const detect = (): EditorInfo => {
        const bin = pick()
        return {key, label, installed: Boolean(bin), bin: bin || undefined}
    }

    const buildSpec = (path: string): ExecSpec | null => {
        const bin = pick()
        if (!bin) return null
        const target = normalizePathForWindowsBinary(bin, path)
        const args = argsFor(target, bin)
        return {cmd: bin, args, line: formatCommandLine(bin, args)}
    }

    const buildFallback = (path: string): string => {
        const list = candidates()
        const bin = pickBinary(list) || list[0] || key.toLowerCase()
        const target = normalizePathForWindowsBinary(bin, path)
        const args = argsFor(target, bin)
        return formatCommandLine(bin, args)
    }

    return {key, label, detect, buildSpec, buildFallback}
}
