import {readFile} from 'fs/promises'
import {join, relative} from 'path'

type CoverageMetrics = {
    total: number
    covered: number
}

type CoverageSummary = {
    lines: CoverageMetrics & { pct: number }
    statements: CoverageMetrics & { pct: number }
    functions: CoverageMetrics & { pct: number }
    branches: CoverageMetrics & { pct: number }
}

const MODULE_PATTERNS: Array<{ name: string; match: (file: string) => boolean }> = [
    {name: 'events', match: (file) => file.startsWith('src/events/')},
    {name: 'db', match: (file) => file.startsWith('src/db/')},
    {name: 'settings', match: (file) => file.startsWith('src/settings/')},
    {name: 'fs', match: (file) => file.startsWith('src/fs/')},
    {name: 'git', match: (file) => file.startsWith('src/git/')},
    {name: 'tickets', match: (file) => file.startsWith('src/projects/tickets/')},
]

const COVERAGE_THRESHOLD = 0.85
const COVERAGE_FILE = join(process.cwd(), 'coverage', 'coverage-summary.json')

async function loadCoverage(): Promise<Record<string, CoverageSummary>> {
    const raw = await readFile(COVERAGE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Record<string, CoverageSummary>
    return parsed
}

function combine(current: CoverageMetrics, next: CoverageMetrics): CoverageMetrics {
    return {
        total: current.total + next.total,
        covered: current.covered + next.covered,
    }
}

function pct({covered, total}: CoverageMetrics): number {
    return total === 0 ? 1 : covered / total
}

async function main() {
    const summary = await loadCoverage()
    const cwd = process.cwd()
    const entries = Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .map(([file, stats]) => ({
            file,
            relative: relative(cwd, file),
            stats,
        }))

    const failures: string[] = []

    for (const module of MODULE_PATTERNS) {
        const metrics = entries
            .filter((entry) => module.match(entry.relative.replace(/\\/g, '/')))
            .map((entry) => entry.stats)

        if (metrics.length === 0) {
            failures.push(`${module.name}: no instrumented files found in coverage output`)
            continue
        }

        const aggregate = metrics.reduce(
            (acc, stats) => ({
                lines: combine(acc.lines, stats.lines),
                statements: combine(acc.statements, stats.statements),
            }),
            {
                lines: {total: 0, covered: 0},
                statements: {total: 0, covered: 0},
            },
        )

        const linePct = pct(aggregate.lines)
        const statementPct = pct(aggregate.statements)

        if (linePct < COVERAGE_THRESHOLD || statementPct < COVERAGE_THRESHOLD) {
            failures.push(
                `${module.name}: lines ${(linePct * 100).toFixed(2)}%, statements ${(statementPct * 100).toFixed(2)}% (minimum ${(COVERAGE_THRESHOLD * 100).toFixed(0)}%)`,
            )
        } else {
            console.info(
                `[coverage] ${module.name} ok — lines ${(linePct * 100).toFixed(1)}%, statements ${(statementPct * 100).toFixed(1)}%`,
            )
        }
    }

    if (failures.length > 0) {
        console.error('[coverage] Threshold check failed:')
        for (const failure of failures) {
            console.error(`  - ${failure}`)
        }
        process.exitCode = 1
        throw new Error('Coverage thresholds per module not met')
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
})
