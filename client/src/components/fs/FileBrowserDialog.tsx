import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Folder, File, ChevronUp, Check, Loader2, AlertCircle } from 'lucide-react'
import { useDirectoryBrowser } from '@/hooks/fs'
import { useEditorSuggestions, useValidateEditorPath } from '@/hooks/editors'
import type { FileBrowserEntry } from 'shared'

interface FileBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
  initialPath?: string
  title?: string
  description?: string
}

export function FileBrowserDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath,
  title = 'Select Editor Executable',
  description = 'Browse to select your IDE executable, or choose from detected editors below.',
}: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '')
  const [manualPath, setManualPath] = useState(initialPath || '')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const { data: browserData, isLoading: isBrowserLoading } = useDirectoryBrowser(currentPath || undefined, {
    enabled: open,
  })

  const { data: suggestions } = useEditorSuggestions()
  const validateMutation = useValidateEditorPath()

  useEffect(() => {
    if (browserData?.currentPath) {
      setCurrentPath(browserData.currentPath)
    }
  }, [browserData])

  const handleSelect = async (path: string) => {
    setIsValidating(true)
    setValidationError(null)
    try {
      const result = await validateMutation.mutateAsync(path)
      if (result.valid) {
        onSelect(path)
      } else {
        setValidationError(result.error || 'Invalid executable')
      }
    } catch (err) {
      setValidationError('Failed to validate path')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
          {suggestions && suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Detected Editors</h3>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={s.key}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualPath(s.bin)
                      handleSelect(s.bin)
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 border rounded-md">
            <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
              <Button
                variant="ghost"
                size="icon"
                disabled={!browserData?.parentPath}
                onClick={() => browserData?.parentPath && setCurrentPath(browserData.parentPath)}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-sm font-mono truncate px-2" title={currentPath}>
                {currentPath}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2">
                {isBrowserLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1">
                    {browserData?.entries.map((entry: FileBrowserEntry) => (
                      <button
                        key={entry.path}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-sm text-left transition-colors w-full"
                        onClick={() => {
                          if (entry.isDirectory) {
                            setCurrentPath(entry.path)
                          } else {
                            setManualPath(entry.path)
                          }
                        }}
                        onDoubleClick={() => {
                          if (!entry.isDirectory) {
                            handleSelect(entry.path)
                          }
                        }}
                      >
                        {entry.isDirectory ? (
                          <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{entry.name}</span>
                        {manualPath === entry.path && !entry.isDirectory && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">Manual Path</h3>
            <div className="flex gap-2">
              <Input
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                placeholder="/path/to/executable"
                className="font-mono text-xs"
              />
              <Button 
                onClick={() => handleSelect(manualPath)} 
                disabled={isValidating || !manualPath}
              >
                {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate & Select
              </Button>
            </div>
            {validationError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {validationError}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 border-t mt-auto">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
