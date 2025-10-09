export function normalizePathInput(input: string) {
    return input.trim()
}

export function slugifyName(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function buildSuggestedPath(baseDir: string, name: string) {
    const slug = slugifyName(name) || 'new-workspace'
    return `${baseDir}/${slug}`
}

export function deriveSlugFromPath(path: string) {
    const parts = path.split(/[\\/]/).filter(Boolean)
    return parts[parts.length - 1] ?? path
}

