const PLATFORM_MAP = {
  'linux:x64': { id: 'linux-x64', binary: 'kanban-ai-linux-x64', zip: 'kanban-ai-linux-x64.zip' },
  'linux:arm64': { id: 'linux-arm64', binary: 'kanban-ai-linux-arm64', zip: 'kanban-ai-linux-arm64.zip' },
  'darwin:arm64': { id: 'darwin-arm64', binary: 'kanban-ai-darwin-arm64', zip: 'kanban-ai-darwin-arm64.zip' },
  'win32:x64': { id: 'win-x64', binary: 'kanban-ai-win-x64.exe', zip: 'kanban-ai-win-x64.zip' },
}

const CODEX_PLATFORM_MAP = {
  'linux:x64': { vendor: 'x86_64-unknown-linux-musl', binary: 'codex' },
  'linux:arm64': { vendor: 'aarch64-unknown-linux-musl', binary: 'codex' },
  'darwin:arm64': { vendor: 'aarch64-apple-darwin', binary: 'codex' },
  'win32:x64': { vendor: 'x86_64-pc-windows-msvc', binary: 'codex.exe' },
}

const CODEX_REGISTRY = 'https://registry.npmjs.org/@openai/codex-sdk'

module.exports = { PLATFORM_MAP, CODEX_PLATFORM_MAP, CODEX_REGISTRY }
