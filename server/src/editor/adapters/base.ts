import {pickBinary} from '../bin'
import {normalizePathForWindowsBinary} from '../../utils/wsl'
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
    transformPath?: (path: string, bin: string) => string
}): EditorAdapter {
    const {key, label, candidates, argsFor, transformPath} = params

    const pick = (): string | null => pickBinary(candidates())

    const detect = (): EditorInfo => {
        const bin = pick()
        return {key, label, installed: Boolean(bin), bin: bin || undefined}
    }

    const computeTarget = (path: string, bin: string): string => {
        if (transformPath) return transformPath(path, bin)
        return normalizePathForWindowsBinary(bin, path)
    }

    const buildSpec = (path: string): ExecSpec | null => {
        const bin = pick()
        if (!bin) return null
        const target = computeTarget(path, bin)
        const args = argsFor(target, bin)
        return {cmd: bin, args, line: formatCommandLine(bin, args)}
    }

    const buildFallback = (path: string): string => {
        const list = candidates()
        const bin = pickBinary(list) || list[0] || key.toLowerCase()
        const target = computeTarget(path, bin)
        const args = argsFor(target, bin)
        return formatCommandLine(bin, args)
    }

    return {key, label, detect, buildSpec, buildFallback}
}
