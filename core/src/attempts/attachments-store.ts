import {promises as fsp} from 'node:fs'
import {join, resolve, sep} from 'node:path'
import type {ImageAttachment, ImageMimeType} from 'shared'
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
    MAX_IMAGE_DATA_URL_LENGTH,
    estimateDecodedBytesFromDataUrl,
    imageDataUrlPrefix,
} from 'shared'

function sanitizeFsSegment(value: string, maxLen = 64): string {
    const trimmed = value.trim()
    const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_')
    const capped = sanitized.slice(0, Math.max(1, maxLen))
    return capped.length ? capped : `id_${crypto.randomUUID().replace(/-/g, '')}`
}

function resolveChildPath(baseDir: string, ...parts: string[]): string {
    const base = resolve(baseDir)
    const out = resolve(baseDir, ...parts)
    const prefix = base.endsWith(sep) ? base : base + sep
    if (!out.startsWith(prefix)) {
        throw new Error('Attachment path escaped base directory')
    }
    return out
}

function extensionForMime(mimeType: ImageMimeType): 'png' | 'jpg' | 'webp' {
    if (mimeType === 'image/png') return 'png'
    if (mimeType === 'image/jpeg') return 'jpg'
    return 'webp'
}

async function resolveGitDir(worktreePath: string): Promise<string | null> {
    const gitPath = join(worktreePath, '.git')
    try {
        const st = await fsp.stat(gitPath)
        if (st.isDirectory()) return gitPath
        if (!st.isFile()) return null
    } catch {
        return null
    }

    try {
        const txt = await fsp.readFile(gitPath, 'utf8')
        const line = txt.split(/\r?\n/).find((l) => l.startsWith('gitdir:'))
        if (!line) return null
        const gitdirRaw = line.slice('gitdir:'.length).trim()
        if (!gitdirRaw) return null
        return resolve(worktreePath, gitdirRaw)
    } catch {
        return null
    }
}

export async function ensureKanbanaiIgnoredInWorktree(worktreePath: string): Promise<void> {
    const gitDir = await resolveGitDir(worktreePath)
    if (!gitDir) return
    const excludePath = join(gitDir, 'info', 'exclude')
    const entry = '.kanbanai/\n'

    try {
        await fsp.mkdir(join(gitDir, 'info'), {recursive: true})
        const existing = await fsp.readFile(excludePath, 'utf8').catch(() => '')
        if (existing.includes('.kanbanai/')) return
        await fsp.appendFile(excludePath, entry, 'utf8')
    } catch {
        // best-effort; ignore failures
    }
}

export type StoredAttachment = {
    fileName: string
    filePath: string
    mimeType: ImageMimeType
}

export function getAttemptAttachmentsDir(worktreePath: string, attemptId: string): string {
    const safeAttemptId = sanitizeFsSegment(attemptId)
    return resolveChildPath(join(worktreePath, '.kanbanai', 'attachments'), safeAttemptId)
}

export async function materializeImageDataUrlToFile(params: {
    worktreePath: string
    attemptId: string
    fileStemHint: string
    attachment: ImageAttachment
}): Promise<StoredAttachment> {
    const {worktreePath, attemptId, fileStemHint, attachment} = params
    const mimeType = attachment.mimeType
    if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
        throw new Error('Unsupported image mime type')
    }
    const prefix = imageDataUrlPrefix(mimeType)
    const dataUrl = attachment.dataUrl.trim()
    if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        throw new Error(`Image data URL exceeds ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`)
    }
    if (!dataUrl.startsWith(prefix)) throw new Error('Unsupported image data URL')
    const estimated = estimateDecodedBytesFromDataUrl(dataUrl, prefix.length)
    if (estimated > MAX_IMAGE_BYTES) {
        throw new Error(`Image exceeds ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`)
    }

    const dir = getAttemptAttachmentsDir(worktreePath, attemptId)
    await fsp.mkdir(dir, {recursive: true})
    await ensureKanbanaiIgnoredInWorktree(worktreePath)

    const safeStem = sanitizeFsSegment(fileStemHint, 48)
    const ext = extensionForMime(mimeType)
    const suffix = crypto.randomUUID().slice(0, 8)
    const fileName = `${safeStem}-${suffix}.${ext}`
    const filePath = resolveChildPath(dir, fileName)

    const base64 = dataUrl.slice(prefix.length)
    const buf = Buffer.from(base64, 'base64')
    await fsp.writeFile(filePath, buf)

    return {fileName, filePath, mimeType}
}

export function resolveAttachmentFilePath(params: {
    worktreePath: string
    attemptId: string
    fileName: string
}): string {
    const {worktreePath, attemptId, fileName} = params
    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
        throw new Error('Invalid attachment name')
    }
    const dir = getAttemptAttachmentsDir(worktreePath, attemptId)
    return resolveChildPath(dir, fileName)
}
