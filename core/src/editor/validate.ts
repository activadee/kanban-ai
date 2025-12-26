import fs from 'node:fs/promises';

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
  } catch (err) {
    return {
      valid: false,
      error: 'File does not exist or is not executable',
    };
  }
}
