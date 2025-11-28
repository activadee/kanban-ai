import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Loader2} from 'lucide-react'
import {GitHubIcon} from '@/components/icons/SimpleIcons'
import {cn} from '@/lib/utils'
import type {GitHubDeviceStartResponse} from 'shared'

export function GithubDeviceFlowStep({
    connected,
    connectedUsername,
    githubConfigMissingId,
    deviceState,
    startingDevice,
    polling,
    githubAuthRefreshing,
    onRefreshStatus,
    onStartConnect,
}: {
    connected: boolean
    connectedUsername: string | null
    githubConfigMissingId: boolean
    deviceState: GitHubDeviceStartResponse | null
    startingDevice: boolean
    polling: boolean
    githubAuthRefreshing: boolean
    onRefreshStatus: () => void
    onStartConnect: () => void
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <GitHubIcon className="size-5"/>
                <div className="text-lg font-semibold">Connect GitHub</div>
                {connected ? (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-900">Connected</Badge>
                ) : (
                    <Badge variant="outline">Not connected</Badge>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
                Use GitHub&apos;s device flow to grant KanbanAI access. We never see your credentials; tokens stay in your local database.
            </p>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-sm font-medium">
                            {connected ? `Signed in as ${connectedUsername}` : 'Awaiting authorization'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {githubConfigMissingId
                                ? 'Add a client ID first, then start the flow.'
                                : connected
                                    ? 'You can continue to the app.'
                                    : 'Click connect to open GitHub and enter the device code.'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefreshStatus}
                            disabled={githubAuthRefreshing}
                        >
                            <Loader2 className={cn('mr-2 size-4', githubAuthRefreshing && 'animate-spin')}/>
                            Refresh
                        </Button>
                        <Button
                            onClick={onStartConnect}
                            disabled={githubConfigMissingId || startingDevice || polling || connected}
                        >
                            {startingDevice ? (
                                <>
                                    <Loader2 className="mr-2 size-4 animate-spin"/>Starting…
                                </>
                            ) : connected ? (
                                'Connected'
                            ) : (
                                'Connect GitHub'
                            )}
                        </Button>
                    </div>
                </div>
                {!connected && deviceState ? (
                    <div className="mt-3 rounded-md border border-dashed border-border/80 bg-card/80 p-3">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Device code</span>
                            <span className="font-mono tracking-widest text-foreground">{deviceState.userCode}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            Enter this code at
                            <button
                                className="text-primary underline"
                                onClick={() => window.open(deviceState.verificationUri, '_blank', 'noopener,noreferrer')}
                            >
                                github.com/login/device
                            </button>
                        </div>
                    </div>
                ) : null}
                {githubConfigMissingId ? (
                    <p className="mt-3 text-xs text-destructive">
                        GitHub app client ID is required. Add it in the previous step.
                    </p>
                ) : null}
            </div>
        </div>
    )
}

