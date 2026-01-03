interface GitCommandConfig {
    allowedFlags: string[]
    requiresValue: string[]
}

const ALLOWED_GIT_COMMANDS: Record<string, GitCommandConfig> = {
    'rev-parse': {
        allowedFlags: ['--abbrev-ref', '--short', '--verify', 'HEAD'],
        requiresValue: [],
    },
    worktree: {
        allowedFlags: ['add', 'remove', 'list', 'prune', '-B'],
        requiresValue: ['-B'],
    },
    fetch: {
        allowedFlags: ['origin', '--prune', '--depth'],
        requiresValue: ['--depth'],
    },
    push: {
        allowedFlags: ['-u', '--force-with-lease', '--set-upstream', '--delete'],
        requiresValue: [],
    },
    status: {
        allowedFlags: ['--porcelain', '-z', '--short'],
        requiresValue: [],
    },
}

export function validateGitArgs(args: string[]): void {
    if (args.length === 0) {
        throw new Error('No git command specified')
    }

    const command = args[0]
    if (!command) {
        throw new Error('No git command specified')
    }

    const config = ALLOWED_GIT_COMMANDS[command]

    if (!config) {
        throw new Error(`Git command '${command}' is not allowed`)
    }

    for (let i = 1; i < args.length; i++) {
        const arg = args[i]
        if (!arg) continue

        if (
            arg.startsWith('-c') ||
            arg.includes('--exec') ||
            arg.includes('--upload-pack') ||
            arg.includes('--receive-pack') ||
            arg.includes('$(') ||
            arg.includes('`') ||
            arg.includes('|') ||
            arg.includes(';') ||
            arg.includes('\n') ||
            arg.includes('\0')
        ) {
            throw new Error(`Dangerous pattern in git argument: ${arg}`)
        }

        if (arg.startsWith('-')) {
            const [flagBase, ...valueParts] = arg.split('=')
            if (!flagBase) {
                throw new Error(`Invalid git flag: ${arg}`)
            }
            if (!config.allowedFlags.includes(flagBase) && !config.allowedFlags.includes(arg)) {
                throw new Error(`Git flag '${arg}' is not allowed for command '${command}'`)
            }
            if (valueParts.length > 0 && config.requiresValue.includes(flagBase)) {
                const value = valueParts.join('=')
                if (value.includes('$(') || value.includes('`') || value.includes(';')) {
                    throw new Error(`Dangerous pattern in flag value: ${value}`)
                }
            }
        } else {
            if (!config.allowedFlags.includes(arg)) {
                throw new Error(`Git argument '${arg}' is not allowed for command '${command}'`)
            }
        }
    }
}
