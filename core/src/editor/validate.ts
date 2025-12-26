import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export type EditorValidationResult = {
  valid: boolean
  error?: string
  version?: string
  name?: string
}

export async function validateEditorExecutable(executablePath: string): Promise<EditorValidationResult> {
  try {
    await fs.access(executablePath, fs.constants.X_OK);
  } catch (err) {
    return {
      valid: false,
      error: 'File does not exist or is not executable',
    };
  }

  try {
    const { stdout } = await execAsync(`"${executablePath}" --version`, { timeout: 5000 });
    const version = stdout.trim();

    return {
      valid: true,
      version,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to run executable: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
