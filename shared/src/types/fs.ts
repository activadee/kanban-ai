export type FileBrowserEntry = {
  name: string
  path: string
  isDirectory: boolean
  isExecutable: boolean
}

export type FileBrowserResponse = {
  entries: FileBrowserEntry[]
  currentPath: string
  parentPath: string | null
}
