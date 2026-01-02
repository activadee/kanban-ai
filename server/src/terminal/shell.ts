/**
 * Detect the default shell based on platform and environment.
 * - Windows: PowerShell > COMSPEC (cmd.exe) > powershell.exe fallback
 * - Unix: SHELL env > bash fallback
 */
export function getDefaultShell(): string {
    const isWindows = process.platform === 'win32'

    if (isWindows) {
        const comspecIncludesPowershell = process.env.COMSPEC?.toLowerCase().includes('powershell')
        return comspecIncludesPowershell ? process.env.COMSPEC! : 'powershell.exe'
    }

    return process.env.SHELL || 'bash'
}
