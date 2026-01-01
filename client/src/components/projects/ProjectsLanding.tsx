import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Plus} from 'lucide-react'
import {ProjectCard, type Project} from './ProjectCard'
import {EmptyProjects} from './EmptyProjects'
import {PageHeader} from '@/components/layout/PageHeader'

interface ProjectsLandingProps {
    projects: Project[]
    onSelect: (id: string) => void
    onCreate: () => void
    onEdit: (project: Project) => void
    onDelete: (project: Project) => void
    loading?: boolean
    error?: string | null
}

function ProjectCardSkeleton() {
    return (
        <Card className="border-border/30 bg-muted/20">
            <div className="animate-pulse space-y-4 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-muted/60"/>
                        <div className="h-3 w-14 rounded bg-muted/60"/>
                    </div>
                    <div className="size-6 rounded bg-muted/40"/>
                </div>
                <div className="space-y-2">
                    <div className="h-5 w-3/4 rounded bg-muted/60"/>
                    <div className="h-4 w-1/2 rounded bg-muted/40"/>
                </div>
                <div className="flex items-center gap-3">
                    <div className="h-3 w-20 rounded bg-muted/40"/>
                    <div className="h-3 w-24 rounded bg-muted/40"/>
                </div>
                <div className="flex items-center justify-between border-t border-border/30 pt-3">
                    <div className="h-3 w-32 rounded bg-muted/40"/>
                    <div className="h-7 w-24 rounded bg-muted/50"/>
                </div>
            </div>
        </Card>
    )
}

function ProjectStats({activeCount, totalCount}: {activeCount: number; totalCount: number}) {
    if (totalCount === 0) return null

    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
                <span className="size-2 animate-pulse rounded-full bg-brand"/>
                <span className="font-medium text-foreground">{activeCount}</span> active
            </span>
            <span className="text-border">|</span>
            <span>
                <span className="font-medium text-foreground">{totalCount}</span> total
            </span>
        </div>
    )
}

export function ProjectsLanding({
    projects,
    onSelect,
    onCreate,
    onEdit,
    onDelete,
    loading = false,
    error = null,
}: ProjectsLandingProps) {
    const activeCount = projects.filter(p => p.status === 'Active').length
    const totalCount = projects.length

    return (
        <div className="flex h-full flex-col overflow-auto bg-background text-foreground">
            <PageHeader
                title="Projects"
                description="Manage your projects and orchestrate AI agents across repositories."
                actions={
                    <Button size="sm" className="gap-1.5" onClick={onCreate}>
                        <Plus className="size-4"/>
                        Create Project
                    </Button>
                }
            >
                {!loading && !error && <ProjectStats activeCount={activeCount} totalCount={totalCount} />}
            </PageHeader>

            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="mx-auto max-w-7xl">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({length: 6}).map((_, i) => (
                                <ProjectCardSkeleton key={i}/>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="mx-auto mt-10 max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-6">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="font-medium text-destructive">Failed to load projects</div>
                            <p className="text-sm text-muted-foreground">{error}</p>
                        </div>
                    </div>
                ) : projects.length ? (
                    <div className="mx-auto max-w-7xl">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {projects.map((project, index) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onOpen={onSelect}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300"
                                    style={{
                                        animationDelay: `${index * 75}ms`,
                                        animationFillMode: 'backwards',
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mx-auto mt-10 max-w-lg">
                        <EmptyProjects onCreate={onCreate}/>
                    </div>
                )}
            </main>
        </div>
    )
}
