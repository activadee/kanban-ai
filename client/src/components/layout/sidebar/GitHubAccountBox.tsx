import {useEffect, useState} from 'react'
import {useQueryClient} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Github} from 'lucide-react'
import type {GitHubAccount} from 'shared'
import {githubKeys} from '@/lib/queryClient'
import {toast} from '@/components/ui/toast'
import {GitHubAccountDialog} from '@/components/github/GitHubAccountDialog'
import {useGithubAuthStatus, useStartGithubDevice, usePollGithubDevice, useLogoutGithub} from '@/hooks'

export function GitHubAccountBox() {
    const queryClient = useQueryClient()
    const authQuery = useGithubAuthStatus()
    const [deviceState, setDeviceState] = useState<import('shared').GitHubDeviceStartResponse | null>(null)
    const [polling, setPolling] = useState(false)
    const [startingDevice, setStartingDevice] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const startMutation = useStartGithubDevice({
        onError: (err) => {
            toast({title: 'GitHub device start failed', description: err.message, variant: 'destructive'})
        },
    })
    const pollMutation = usePollGithubDevice({
        onError: (err) => {
            toast({title: 'GitHub device polling failed', description: err.message, variant: 'destructive'})
        },
    })
    const logoutMutation = useLogoutGithub({
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: githubKeys.check()})
            setModalOpen(false)
            setDeviceState(null)
            setPolling(false)
        },
        onError: (err) => {
            toast({title: 'GitHub disconnect failed', description: err.message, variant: 'destructive'})
        },
    })

    useEffect(() => {
        if (!polling || !deviceState) return
        let cancelled = false
        let timer: number | undefined
        let inFlight = false
        const poll = async () => {
            if (cancelled || inFlight) return
            inFlight = true
            try {
                const result = await pollMutation.mutateAsync()
                if (cancelled) return
                if (result.status === 'authorization_pending') {
                    timer = window.setTimeout(poll, deviceState.interval * 1000)
                } else if (result.status === 'slow_down') {
                    timer = window.setTimeout(poll, (deviceState.interval + 5) * 1000)
                } else if (result.status === 'success') {
                    setPolling(false)
                    setDeviceState(null)
                    await queryClient.invalidateQueries({queryKey: githubKeys.check()})
                } else {
                    setPolling(false)
                    setDeviceState(null)
                }
            } catch {
                if (!cancelled) {
                    setPolling(false)
                    setDeviceState(null)
                }
            } finally {
                inFlight = false
            }
        }
        // kick off immediately once
        timer = window.setTimeout(poll, 0)
        return () => {
            cancelled = true
            if (typeof timer === 'number') window.clearTimeout(timer)
        }
    }, [polling, deviceState, queryClient, pollMutation])

    const openVerificationLink = (state?: import('shared').GitHubDeviceStartResponse | null) => {
        const s = state ?? deviceState
        if (!s) return
        window.open(s.verificationUri, '_blank', 'noopener,noreferrer')
    }

    const startGithubConnect = async () => {
        setStartingDevice(true)
        try {
            const payload = await startMutation.mutateAsync()
            setDeviceState(payload)
            setPolling(true)
            try {
                await navigator.clipboard.writeText(payload.userCode)
            } catch (err) {
                console.warn('clipboard copy failed', err)
            }
            openVerificationLink(payload)
        } catch (err) {
            console.error('start device flow failed', err)
        } finally {
            setStartingDevice(false)
        }
    }

    const connected = authQuery.data?.status === 'valid'
    const account: GitHubAccount | null = authQuery.data?.status === 'valid' ? authQuery.data.account : null
    const username = account?.username
    const avatar = account?.avatarUrl ?? null

    return (
        <div className="rounded-md border border-border/60 bg-background/60 p-3">
            {connected ? (
                <button type="button" onClick={() => setModalOpen(true)}
                        className="flex w-full items-center gap-3 text-left hover:opacity-90">
                    {avatar ? (
                        <img src={avatar} alt="GitHub avatar" className="size-6 rounded-full"/>
                    ) : (
                        <Github className="size-5"/>
                    )}
                    <div className="text-sm">
                        <div className="font-medium">{username ?? 'GitHub'}</div>
                        <div className="text-xs text-muted-foreground">Connected</div>
                    </div>
                </button>
            ) : (
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Github className="size-5"/>
                        <div className="text-sm">GitHub</div>
                    </div>
                    <Button size="sm" onClick={startGithubConnect}
                            disabled={startingDevice || polling || authQuery.isFetching}>
                        {polling ? 'Waiting…' : 'Connect'}
                    </Button>
                </div>
            )}
            {!connected && deviceState ? (
                <div className="mt-2 rounded bg-muted/30 p-2 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Device code</span>
                        <span className="font-mono tracking-widest">{deviceState.userCode}</span>
                    </div>
                    <div className="mt-1">
                        <button className="text-xs underline" onClick={() => openVerificationLink()}>Open GitHub
                        </button>
                    </div>
                </div>
            ) : null}
            <GitHubAccountDialog
                open={modalOpen}
                onOpenChange={setModalOpen}
                username={username ?? null}
                primaryEmail={account?.primaryEmail ?? null}
                onDisconnect={() => logoutMutation.mutate()}
                disconnecting={logoutMutation.isPending}
            />
        </div>
    )
}

