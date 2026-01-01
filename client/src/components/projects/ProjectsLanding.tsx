import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Plus} from 'lucide-react'
import {ProjectCard, type Project} from './ProjectCard'
import {EmptyProjects} from './EmptyProjects'

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
            <section className="relative overflow-hidden border-b border-border/40">
                <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-primary/3"/>
                <div
                    className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23888888' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />
                <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                Your Projects
                            </h1>
                            <p className="max-w-lg text-sm text-muted-foreground">
                                Orchestrate AI agents across your repositories. Each project connects to a git workspace where agents turn tickets into pull requests.
                            </p>
                        </div>

                        <div className="flex flex-col items-start gap-3 md:items-end">
                            <Button size="default" className="gap-2" onClick={onCreate}>
                                <Plus className="size-4"/>
                                Create Project
                            </Button>

                            {!loading && !error && totalCount > 0 && (
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
                            )}
                        </div>
                    </div>
                </div>
            </section>

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
