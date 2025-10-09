// Decodes a base64-like stream where tokens may be chunked or padded inconsistently.
export function decodeBase64Stream(input: string): string {
    const td = new TextDecoder()

    const isMostlyPrintable = (s: string) => {
        if (!s) return false
        let printable = 0
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i)
            // tab/newline/CR or visible ASCII
            if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0x7e)) printable++
        }
        return printable / s.length >= 0.8
    }

    const decodeChunk = (rawToken: string): string | null => {
        try {
            const sanitized = rawToken.replace(/^[=]+/, '')
            if (!sanitized) return null
            const pad = sanitized.length % 4
            const padded = pad ? sanitized + '='.repeat(4 - pad) : sanitized
            const bin = atob(padded)
            const buf = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
            const text = td.decode(buf)
            return isMostlyPrintable(text) ? text : null
        } catch {
            return null
        }
    }

    try {
        // 1) Try decoding the whole sanitized string
        const all = input.replace(/[^A-Za-z0-9+/=]+/g, '')
        const whole = decodeChunk(all)
        if (whole) return whole

        // 2) Decode per-base64 segment (min length 8), commonly delimited by padding
        const tokens = input.match(/[A-Za-z0-9+/]{8,}={0,2}/g) ?? []
        const out: string[] = []
        for (const token of tokens) {
            const text = decodeChunk(token)
            if (text) out.push(text)
        }
        return out.length ? out.join('') : input
    } catch {
        return input
    }
}

