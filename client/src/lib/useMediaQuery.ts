import {useEffect, useState} from 'react'

export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        return window.matchMedia(query).matches
    })

    useEffect(() => {
        const mql = window.matchMedia(query)
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
        // Safari <16 fallback using deprecated addListener/removeListener
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler)
        else mql.addListener?.(handler)
        setMatches(mql.matches)
        return () => {
            if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', handler)
            else mql.removeListener?.(handler)
        }
    }, [query])

    return matches
}
