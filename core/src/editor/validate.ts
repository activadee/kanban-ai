import fs from 'node:fs/promises';
import path from 'node:path';

export type EditorValidationResult = {
  valid: boolean
  error?: string
}

export async function validateEditorExecutable(executablePath: string): Promise<EditorValidationResult> {
  try {
    await fs.access(executablePath, fs.constants.X_OK);

    return {
      valid: true,
    };
  } catch {
    // On Windows, check for executable extensions since fs.access(X_OK) doesn't work
    if (process.platform === 'win32') {
      const ext = path.extname(executablePath).toLowerCase();
      const isExecutable = ['.exe', '.bat', '.cmd', '.com'].includes(ext);
      if (isExecutable) {
        // Also verify the file exists
        try {
          await fs.access(executablePath, fs.constants.F_OK);
          return { valid: true };
        } catch {
          return {
            valid: false,
            error: 'File does not exist',
          };
        }
      }
    }

    return {
      valid: false,
      error: 'File does not exist or is not executable',
    };
  }
}
