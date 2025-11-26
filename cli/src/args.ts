export interface CliOptions {
    binaryVersion?: string
    noUpdateCheck: boolean
    showCliVersion: boolean
    showHelp: boolean
    showBinaryVersionOnly: boolean
    passThroughArgs: string[]
}

export function parseCliArgs(argv: string[], envVersionOverride?: string, envNoUpdateCheck = false): CliOptions {
    const args = [...argv]

    let binaryVersion = envVersionOverride
    let noUpdateCheck = envNoUpdateCheck
    let showCliVersion = false
    let showHelp = false
    let showBinaryVersionOnly = false

    const passThroughArgs: string[] = []

    while (args.length > 0) {
        const arg = args.shift()!

        if (arg === '--') {
            passThroughArgs.push(...args)
            break
        }

        if (arg === '--binary-version') {
            const next = args.shift()
            if (!next) {
                throw new Error('--binary-version flag requires a version value')
            }
            binaryVersion = next
            continue
        }

        if (arg.startsWith('--binary-version=')) {
            binaryVersion = arg.split('=', 2)[1]
            continue
        }

        if (arg === '--no-update-check') {
            noUpdateCheck = true
            continue
        }

        if (arg === '--cli-version') {
            showCliVersion = true
            continue
        }

        if (arg === '--help' || arg === '-h') {
            showHelp = true
            continue
        }

        if (arg === '--version' || arg === '-v') {
            showBinaryVersionOnly = true
            continue
        }

        passThroughArgs.push(arg)
    }

    return {
        binaryVersion,
        noUpdateCheck,
        showCliVersion,
        showHelp,
        showBinaryVersionOnly,
        passThroughArgs,
    }
}
