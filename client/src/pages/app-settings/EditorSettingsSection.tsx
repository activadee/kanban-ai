import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FileBrowserDialog } from '@/components/fs/FileBrowserDialog'
import { FolderOpen, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface EditorSettingsSectionProps {
  editorCommand: string | null
  validationStatus?: 'valid' | 'invalid' | 'pending' | null
  onChange: (value: string | null) => void
}

export function EditorSettingsSection({
  editorCommand,
  validationStatus,
  onChange,
}: EditorSettingsSectionProps) {
  const [browserOpen, setBrowserOpen] = useState(false)
  
  return (
    <section className="p-6">
      <div className="mb-4">
        <h2 className="text-base font-medium">Editor</h2>
        <p className="text-sm text-muted-foreground">
          Configure the editor used to open project files. Select the executable path for your IDE.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Label>Editor executable</Label>
        </div>
        <div className="sm:col-span-2 max-w-md space-y-2">
          <div className="flex gap-2">
            <Input
              value={editorCommand || ''}
              onChange={(e) => onChange(e.target.value || null)}
              placeholder="/path/to/editor"
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setBrowserOpen(true)}
              title="Browse for executable"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            {editorCommand && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onChange(null)}
                title="Clear"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {validationStatus === 'valid' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Valid executable
            </p>
          )}
          {validationStatus === 'invalid' && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Invalid or not executable
            </p>
          )}
          {validationStatus === 'pending' && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Validating...
            </p>
          )}
          
          {!editorCommand && (
            <p className="text-xs text-muted-foreground">
              No editor configured. The "Open in Editor" feature will be disabled.
            </p>
          )}
        </div>
      </div>
      
      <FileBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={(path) => {
          onChange(path)
          setBrowserOpen(false)
        }}
        initialPath={editorCommand || undefined}
      />
    </section>
  )
}
