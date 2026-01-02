import {useRef, useEffect, useCallback, useState} from 'react'
import {Terminal} from 'xterm'
import {FitAddon} from '@xterm/addon-fit'
import {WebLinksAddon} from '@xterm/addon-web-links'
import type {TerminalInputMessage, TerminalOutputMessage} from 'shared'
import {getTerminalWebSocketUrl} from '@/api/terminals'

export type TerminalStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseTerminalOptions {
    cardId: string
    projectId: string
    onExit?: (code: number) => void
    onError?: (message: string) => void
}

export interface UseTerminalReturn {
    terminalRef: React.RefObject<HTMLDivElement | null>
    status: TerminalStatus
    connect: () => void
    disconnect: () => void
    fit: () => void
}

export function useTerminal({
    cardId,
    projectId,
    onExit,
    onError,
}: UseTerminalOptions): UseTerminalReturn {
    const terminalRef = useRef<HTMLDivElement | null>(null)
    const xtermRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const wsRef = useRef<WebSocket | null>(null)
    const [status, setStatus] = useState<TerminalStatus>('disconnected')
    const statusRef = useRef<TerminalStatus>(status)
    statusRef.current = status

    const cleanup = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        if (xtermRef.current) {
            xtermRef.current.dispose()
            xtermRef.current = null
        }
        fitAddonRef.current = null
    }, [])

    const sendMessage = useCallback((msg: TerminalInputMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg))
        }
    }, [])

    const fit = useCallback(() => {
        if (fitAddonRef.current && xtermRef.current) {
            fitAddonRef.current.fit()
            const {cols, rows} = xtermRef.current
            sendMessage({type: 'resize', cols, rows})
        }
    }, [sendMessage])

    const connect = useCallback(() => {
        if (!terminalRef.current) return
        cleanup()

        setStatus('connecting')

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                cursor: '#ffffff',
                cursorAccent: '#000000',
                selectionBackground: '#264f78',
            },
            allowProposedApi: true,
        })

        const fitAddon = new FitAddon()
        const webLinksAddon = new WebLinksAddon()

        term.loadAddon(fitAddon)
        term.loadAddon(webLinksAddon)

        term.open(terminalRef.current)
        fitAddon.fit()

        xtermRef.current = term
        fitAddonRef.current = fitAddon

        const wsUrl = getTerminalWebSocketUrl(cardId, projectId)
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
            setStatus('connected')
            const {cols, rows} = term
            sendMessage({type: 'resize', cols, rows})
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as TerminalOutputMessage
                switch (msg.type) {
                    case 'data':
                        term.write(msg.data)
                        break
                    case 'exit':
                        setStatus('disconnected')
                        onExit?.(msg.code)
                        break
                    case 'error':
                        setStatus('error')
                        onError?.(msg.message)
                        break
                }
            } catch {
                term.write(event.data)
            }
        }

        ws.onerror = () => {
            setStatus('error')
            onError?.('WebSocket connection error')
        }

        ws.onclose = () => {
            if (statusRef.current !== 'error') {
                setStatus('disconnected')
            }
        }

        term.onData((data) => {
            sendMessage({type: 'data', data})
        })

        term.onResize(({cols, rows}) => {
            sendMessage({type: 'resize', cols, rows})
        })
    }, [cardId, projectId, cleanup, sendMessage, onExit, onError])

    const disconnect = useCallback(() => {
        cleanup()
        setStatus('disconnected')
    }, [cleanup])

    useEffect(() => {
        return () => {
            cleanup()
        }
    }, [cleanup])

    return {
        terminalRef,
        status,
        connect,
        disconnect,
        fit,
    }
}
