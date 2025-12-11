import {useCallback, useEffect, useState} from 'react'
import {formatRelativeTime} from '@/lib/time'

export function useRelativeTimeFormatter(intervalMs = 30_000): (value: string | null | undefined) => string {
    const [tick, setTick] = useState(0)

    useEffect(() => {
        const id = window.setInterval(() => {
            setTick((previous) => previous + 1)
        }, intervalMs)
        return () => {
            window.clearInterval(id)
        }
    }, [intervalMs])

    return useCallback(
        (value: string | null | undefined) => formatRelativeTime(value) ?? '—',
        [tick],
    )
}

