import {useState, useEffect} from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue
        }
        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error)
            return initialValue
        }
    })

    // Sync across browser tabs
    useEffect(() => {
        if (typeof window === 'undefined') return

        const handleStorage = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(JSON.parse(e.newValue))
                } catch {
                    console.error(`Error parsing localStorage key "${key}":`, e.newValue)
                }
            }
        }

        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [key])

    const setValue = (value: T | ((val: T) => T)) => {
        try {
            setStoredValue((prevStoredValue: T) => {
                const valueToStore = typeof value === 'function'
                    ? (value as (val: T) => T)(prevStoredValue)
                    : value

                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(valueToStore))
                }

                return valueToStore
            })
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error)
        }
    }

    return [storedValue, setValue] as const
}
