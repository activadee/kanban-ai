import {Link} from 'react-router-dom'

type ProjectSnap = {
    id: string
    name: string
    repositorySlug: string | null
    repositoryPath: string
    totalCards: number
    openCards: number
    activeAttempts: number
}

export function ProjectSnapshotList({
                                        items,
                                        isLoading,
                                    }: {
    items: ProjectSnap[]
    isLoading: boolean
}) {
    return (
        <>
            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({length: 4}).map((_, i) => (
                        <div key={i} className="h-12 animate-pulse rounded-md bg-muted/60"/>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Create a project to populate this list.</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((project) => (
                        <li key={project.id} className="rounded-md border border-border/60 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <Link to={`/projects/${project.id}`}
                                          className="text-sm font-medium text-foreground hover:underline">
                                        {project.name}
                                    </Link>
                                    <div
                                        className="text-xs text-muted-foreground">{project.repositorySlug ?? project.repositoryPath}</div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                    <div>{project.totalCards} cards</div>
                                    <div>{project.openCards} open · {project.activeAttempts} active attempts</div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    )
}

