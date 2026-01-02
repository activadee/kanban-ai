/**
 * Detect the default shell based on platform and environment.
 * - Windows: PowerShell (if in COMSPEC) > COMSPEC (cmd.exe) > cmd.exe fallback
 * - Unix: SHELL env > /bin/sh fallback
 */
export function getDefaultShell(): string {
    const isWindows = process.platform === 'win32'

    if (isWindows) {
        const comspec = process.env.COMSPEC
        // If COMSPEC points to PowerShell, use it
        if (comspec?.toLowerCase().includes('powershell')) {
            return comspec
        }
        // Otherwise use COMSPEC (usually cmd.exe) or fall back to cmd.exe
        return comspec || 'cmd.exe'
    }

    // Unix: Use SHELL env or fall back to /bin/sh (more portable than bash)
    return process.env.SHELL || '/bin/sh'
}
