import {useEffect, useMemo, useRef} from 'react'
import {DiffView, DiffModeEnum} from '@git-diff-view/react'
// Use the pure CSS to avoid global Tailwind utilities from affecting the app
import '@git-diff-view/react/styles/diff-view-pure.css'
import '@/styles/diff-overrides.css'
import {generateDiffFile, type DiffFile} from '@git-diff-view/file'

function extToLang(path?: string) {
    if (!path) return 'plaintext'
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'typescript'
        case 'js':
        case 'jsx':
            return 'javascript'
        case 'json':
            return 'json'
        case 'md':
            return 'markdown'
        case 'css':
        case 'scss':
            return 'css'
        case 'html':
            return 'html'
        case 'rs':
            return 'rust'
        case 'py':
            return 'python'
        case 'go':
            return 'go'
        case 'java':
            return 'java'
        case 'kt':
            return 'kotlin'
        case 'cs':
            return 'csharp'
        case 'sql':
            return 'sql'
        case 'yml':
        case 'yaml':
            return 'yaml'
        case 'sh':
            return 'bash'
        case 'toml':
            return 'toml'
        default:
            return 'plaintext'
    }
}

export function DiffPanel({
                              filePath,
                              baseContent,
                              rightContent,
                              showOnly,
                          }: {
    filePath: string
    baseContent: string
    rightContent: string
    showOnly: boolean
}) {
    const lang = extToLang(filePath)
    const diffFile = useMemo(() => {
        const name = filePath || 'file'
        const file = generateDiffFile(name, baseContent ?? '', name, rightContent ?? '', lang, lang)
        // Init raw to enable context expansion inside the library
        file.initRaw()
        return file
    }, [filePath, baseContent, rightContent, lang])

    const viewRef = useRef<{ getDiffFileInstance: () => DiffFile } | null>(null)
    useEffect(() => {
        try {
            const inst = viewRef.current?.getDiffFileInstance?.()
            if (!inst) return
            const unified = 'unified' as const
            if (showOnly) inst.onAllCollapse(unified)
            else inst.onAllExpand(unified)
        } catch { /* empty */
        }
    }, [showOnly, diffFile])

    return (
        <div className="rounded-md border bg-background">
            <div className="diff-tailwindcss-wrapper overflow-x-auto">
                <div className="inline-block min-w-full align-top text-xs leading-relaxed">
                    <DiffView
                        ref={viewRef}
                        diffFile={diffFile}
                        diffViewWrap={false}
                        diffViewMode={DiffModeEnum.Unified}
                        diffViewHighlight
                        diffViewFontSize={12}
                    />
                </div>
            </div>
        </div>
    )
}

export default DiffPanel
