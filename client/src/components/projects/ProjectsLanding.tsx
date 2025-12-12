import {Button} from "@/components/ui/button";
import {Loader2, Plus} from "lucide-react";
import {ProjectCard, type Project} from "./ProjectCard";
import {EmptyProjects} from "./EmptyProjects";
import {PageHeader} from "@/components/layout/PageHeader";

interface ProjectsLandingProps {
    projects: Project[];
    onSelect: (id: string) => void;
    onCreate: () => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
    loading?: boolean;
    error?: string | null;
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
    return (
        <div className="flex h-full flex-col overflow-auto bg-background text-foreground">
            <PageHeader
                title="Projects"
                description="Manage your projects and track their progress."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCreate}
                        className="flex items-center gap-1"
                    >
                        <Plus className="size-4"/>
                        Create Project
                    </Button>
                }
            />

            <main className="px-4 py-6 sm:px-6 lg:px-8">

                {loading ? (
                    <div className="mt-10 flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin"/>
                        <span>Loading projects…</span>
                    </div>
                ) : error ? (
                    <div
                        className="mt-10 rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
                        {error}
                    </div>
                ) : projects.length ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {projects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onOpen={onSelect}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="mt-10">
                        <EmptyProjects onCreate={onCreate}/>
                    </div>
                )}
            </main>
        </div>
    );
}
