import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type FileBrowserEntry = {
  name: string
  path: string
  isDirectory: boolean
  isExecutable: boolean
  size?: number
}

export type BrowseDirectoryOptions = {
  path?: string
  showHidden?: boolean
  executablesOnly?: boolean
}

export type BrowseDirectoryResult = {
  entries: FileBrowserEntry[]
  currentPath: string
  parentPath: string | null
}

export async function browseDirectory(options?: BrowseDirectoryOptions): Promise<BrowseDirectoryResult> {
  const targetPath = options?.path || os.homedir();
  const showHidden = options?.showHidden ?? false;
  const executablesOnly = options?.executablesOnly ?? false;

  const absolutePath = path.resolve(targetPath);
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  const resultEntries: FileBrowserEntry[] = [];

  for (const entry of entries) {
    if (!showHidden && entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(absolutePath, entry.name);
    let isExecutable = false;
    const isDirectory = entry.isDirectory();

    if (!isDirectory) {
      try {
        await fs.access(fullPath, fs.constants.X_OK);
        isExecutable = true;
      } catch {
        if (process.platform === 'win32') {
          const ext = path.extname(entry.name).toLowerCase();
          isExecutable = ['.exe', '.bat', '.cmd', '.com'].includes(ext);
        }
      }
    }

    if (executablesOnly && !isExecutable && !isDirectory) {
      continue;
    }

    let size: number | undefined;
    if (!isDirectory) {
      try {
        const stats = await fs.stat(fullPath);
        size = stats.size;
      } catch {
      }
    }

    resultEntries.push({
      name: entry.name,
      path: fullPath,
      isDirectory,
      isExecutable,
      size,
    });
  }

  resultEntries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  const parentPath = absolutePath === path.parse(absolutePath).root ? null : path.dirname(absolutePath);

  return {
    entries: resultEntries,
    currentPath: absolutePath,
    parentPath,
  };
}
