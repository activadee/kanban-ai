const pkg = require('../package.json')
const { compareSemver, isInteractive, promptYesNo } = require('./utils')

async function fetchLatestCliVersion() {
  try {
    const res = await fetch('https://registry.npmjs.org/kanban-ai/latest')
    if (res.ok) {
      const data = await res.json()
      if (data?.version) return data.version
    }
  } catch (error) {
    // best-effort; silence
  }
  return null
}

async function fetchLatestGitHubReleaseVersion() {
  try {
    const res = await fetch('https://api.github.com/repos/activadee/kanban-ai/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.tag_name) return data.tag_name.replace(/^v/, '')
    }
  } catch {
    // best-effort
  }
  return null
}

async function resolveDesiredVersion({ binaryVersion, envVersion }) {
  const hasExplicitVersion = Boolean(binaryVersion || envVersion)
  const baseVersion = binaryVersion || envVersion || pkg.version

  if (hasExplicitVersion) return { version: baseVersion, updated: false, baseVersion }

  const latestCandidates = []
  const npmLatest = await fetchLatestCliVersion()
  if (npmLatest) latestCandidates.push(npmLatest)
  const githubLatest = await fetchLatestGitHubReleaseVersion()
  if (githubLatest) latestCandidates.push(githubLatest)

  if (!latestCandidates.length) return { version: baseVersion, updated: false, baseVersion }

  const latest = latestCandidates.reduce((max, curr) => (compareSemver(curr, max) > 0 ? curr : max), latestCandidates[0])
  if (!latest) return { version: baseVersion, updated: false, baseVersion }

  const isNewer = compareSemver(latest, baseVersion) > 0
  if (!isNewer) return { version: baseVersion, updated: false, baseVersion }

  if (!isInteractive()) {
    console.log(`[kanban-ai] auto-updating to latest binary ${latest} (was ${baseVersion}).`)
    return { version: latest, updated: true, baseVersion }
  }

  const shouldUpdate = await promptYesNo(
    `[kanban-ai] A newer KanbanAI binary is available (current ${baseVersion}, latest ${latest}). Download and use it now? [Y/n] `,
  )

  if (shouldUpdate) return { version: latest, updated: true, baseVersion }
  return { version: baseVersion, updated: false, baseVersion }
}

module.exports = {
  fetchLatestCliVersion,
  fetchLatestGitHubReleaseVersion,
  resolveDesiredVersion,
}
