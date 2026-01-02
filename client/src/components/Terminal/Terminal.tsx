import {useEffect, useCallback} from 'react'
import {useTerminal, type TerminalStatus} from './useTerminal'
import {cn} from '@/lib/utils'
import 'xterm/css/xterm.css'

export interface TerminalProps {
    cardId: string
    projectId: string
    className?: string
    onStatusChange?: (status: TerminalStatus) => void
    onExit?: (code: number) => void
    onError?: (message: string) => void
}

export function Terminal({
    cardId,
    projectId,
    className,
    onStatusChange,
    onExit,
    onError,
}: TerminalProps) {
    const {terminalRef, status, connect, fit} = useTerminal({
        cardId,
        projectId,
        onExit,
        onError,
    })

    useEffect(() => {
        onStatusChange?.(status)
    }, [status, onStatusChange])

    useEffect(() => {
        connect()
    }, [connect])

    const handleResize = useCallback(() => {
        fit()
    }, [fit])

    useEffect(() => {
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [handleResize])

    return (
        <div
            ref={terminalRef}
            className={cn('h-full w-full min-h-[200px]', className)}
        />
    )
}
