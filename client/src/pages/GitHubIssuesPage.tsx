import {useParams} from 'react-router-dom'
import {GitPullRequestDraft} from 'lucide-react'
import {PageHeader} from '@/components/layout/PageHeader'

export function GitHubIssuesPage() {
    const {projectId} = useParams<{projectId: string}>()

    return (
        <div className="flex h-full flex-col">
            <PageHeader title="GitHub Issues" />
            <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-full bg-muted/20 p-4">
                        <GitPullRequestDraft className="size-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold">GitHub Issues</h2>
                        <p className="text-sm text-muted-foreground">
                            Coming soon. This page will display and manage GitHub issues for this project.
                        </p>
                        {projectId && (
                            <p className="text-xs text-muted-foreground/60">
                                Project ID: {projectId}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
