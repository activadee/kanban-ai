import {FolderGit, FolderPlus} from 'lucide-react'

export function ProjectTypeCard({title, description, icon, onClick}: {
    title: string;
    description: string;
    icon: 'repo' | 'blank';
    onClick: () => void
}) {
    const Icon = icon === 'repo' ? FolderGit : FolderPlus
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-start gap-3 rounded-lg border border-border/60 bg-muted/10 p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
      <span
          className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5"/>
      </span>
            <span className="flex-1 space-y-1">
        <span className="block font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
        </button>
    )
}

