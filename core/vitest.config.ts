import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json-summary', 'lcov'],
            include: [
                'src/events/bus.ts',
                'src/db/provider.ts',
                'src/settings/service.ts',
                'src/fs/repos.ts',
                'src/fs/git.ts',
                'src/git/branch.ts',
                'src/git/service.ts',
                'src/projects/tickets/ticket-keys.ts',
            ],
            thresholds: {
                statements: 85,
                branches: 60,
                lines: 85,
                functions: 80,
            },
        },
    },
})
