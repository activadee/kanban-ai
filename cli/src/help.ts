export function printHelp() {
    // Basic wrapper help; underlying binary has its own help output.
    const lines = [
        'KanbanAI CLI wrapper',
        '',
        'Usage:',
        '  kanban-ai [wrapper-options] -- [kanban-ai-binary-options]',
        '  kanban-ai [wrapper-options] [kanban-ai-binary-options]',
        '',
        'Wrapper options:',
        '  --binary-version <version>   Run a specific KanbanAI binary version (e.g. 0.4.0).',
        '  --no-update-check           Do not check GitHub for a newer version; use cached version if available.',
        '  --cli-version               Print the CLI wrapper version and exit.',
        '  -v, --version               Print the KanbanAI binary version that will be used and exit.',
        '  -h, --help                  Show this help message and exit.',
        '',
        'Environment variables:',
        '  KANBANAI_BINARY_VERSION     Pin a specific binary version.',
        '  KANBANAI_HOME               Override the base directory for the binary cache.',
        '  KANBANAI_GITHUB_REPO        Override the GitHub repo (default: activadee/kanban-ai).',
        '  KANBANAI_NO_UPDATE_CHECK    If set to 1/true, skip update checks and use cached version.',
        '  KANBANAI_ASSUME_YES         If set, automatically accept update prompts.',
        '  KANBANAI_ASSUME_NO          If set, automatically decline update prompts.',
        '',
        'All other arguments are forwarded to the KanbanAI binary.',
    ]

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'))
}
