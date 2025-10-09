let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const win = window as typeof window & { webkitAudioContext?: typeof AudioContext }
    const Ctx = win.AudioContext ?? win.webkitAudioContext
    if (!Ctx) return null
    if (!audioCtx) {
        try {
            audioCtx = new Ctx()
        } catch {
            audioCtx = null
        }
    }
    return audioCtx
}

export async function playAgentCompletionSound(): Promise<void> {
    const ctx = getAudioContext()
    if (!ctx) return
    try {
        if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {
            })
        }
    } catch {
        // Ignore resume failures; attempting to play will fail gracefully.
    }

    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(0.05, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    gain.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.35)
    osc.connect(gain)

    const cleanup = () => {
        osc.disconnect()
        gain.disconnect()
        osc.removeEventListener('ended', cleanup)
    }

    osc.addEventListener('ended', cleanup)
    osc.start(now)
    osc.stop(now + 0.5)
}
