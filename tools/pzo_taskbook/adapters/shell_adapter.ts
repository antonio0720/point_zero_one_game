// shell_adapter.ts
import { spawn } from 'child_process';
import * as path from 'path';

interface ShellAdapterOptions {
  cwd?: string;
  timeout?: number;
  stdout?: boolean;
  stderr?: boolean;
  redact?: boolean;
}

class ShellAdapter {
  private readonly mlEnabled: boolean;

  constructor(mlEnabled: boolean) {
    this.mlEnabled = mlEnabled;
  }

  async run(
    command: string,
    options: ShellAdapterOptions = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd, timeout, stdout, stderr, redact } = options;

    if (cwd && !this.isAllowedCwd(cwd)) {
      throw new Error(`Invalid CWD: ${cwd}`);
    }

    try {
      const process = spawn(command, { shell: true });

      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        if (stdout) {
          output += data.toString();
        }
      });

      process.stderr.on('data', (data) => {
        if (stderr) {
          error += data.toString();
        }
      });

      await new Promise((resolve, reject) => {
        process.on('exit', (code) => {
          resolve({ exitCode: code });
        });

        process.on('error', (err) => {
          reject(err);
        });
      });

      if (redact && this.mlEnabled) {
        output = this.redactOutput(output);
      }

      return { stdout: output, stderr: error, exitCode: 0 };
    } catch (err) {
      throw new Error(`Error running command: ${command} - ${err.message}`);
    }
  }

  private isAllowedCwd(cwd: string): boolean {
    const allowedPaths = ['/path/to/allowed/cwd1', '/path/to/allowed/cwd2'];
    return allowedPaths.includes(cwd);
  }

  private redactOutput(output: string): string {
    // Implement output redaction logic here
    return output;
  }
}

export { ShellAdapter };
