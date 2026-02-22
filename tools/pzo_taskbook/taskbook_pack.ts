// taskbook_pack.ts
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as crypto from 'crypto';

interface TaskbookPackOptions {
  inputDir: string;
  outputZipPath: string;
}

class TaskbookPack {
  private readonly inputDir: string;

  constructor(options: TaskbookPackOptions) {
    this.inputDir = options.inputDir;
  }

  async pack(): Promise<string> {
    const files = await this.getFiles();
    const manifest = await this.createManifest(files);
    const zipBuffer = await this.createZip(files, manifest);

    return zipBuffer.toString('base64');
  }

  private async getFiles(): Promise<{ name: string; contents: Buffer }[]> {
    const files: { name: string; contents: Buffer }[] = [];

    const ndjsonPath = path.join(this.inputDir, 'ndjson');
    if (fs.existsSync(ndjsonPath)) {
      const ndjsonBuffer = fs.readFileSync(ndjsonPath);
      const lines = ndjsonBuffer.toString().split('\n');

      for (const line of lines) {
        files.push({ name: `${path.basename(ndjsonPath)}.ndjson`, contents: Buffer.from(line, 'utf8') });
      }
    }

    const readmePath = path.join(this.inputDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      files.push({ name: 'README.md', contents: fs.readFileSync(readmePath) });
    }

    const reportsPath = path.join(this.inputDir, 'reports');
    if (fs.existsSync(reportsPath)) {
      const reportFiles = await this.getReportFiles(reportsPath);
      for (const file of reportFiles) {
        files.push(file);
      }
    }

    return files;
  }

  private async getReportFiles(dir: string): Promise<{ name: string; contents: Buffer }[]> {
    const files: { name: string; contents: Buffer }[] = [];

    const dirContents = await fs.promises.readdir(dir);

    for (const file of dirContents) {
      const filePath = path.join(dir, file);
      if ((await fs.promises.stat(filePath)).isFile()) {
        const reportBuffer = await fs.promises.readFile(filePath);
        files.push({ name: file, contents: reportBuffer });
      }
    }

    return files;
  }

  private async createManifest(files: { name: string; contents: Buffer }[]): Promise<string> {
    const manifestLines: string[] = [];

    for (const file of files) {
      const hash = crypto.createHash('sha256');
      hash.update(file.contents);
      manifestLines.push(`${file.name} ${hash.digest('hex')}`);
    }

    return manifestLines.join('\n');
  }

  private async createZip(files: { name: string; contents: Buffer }[], manifest: string): Promise<Buffer> {
    const zip = zlib.createDeflate();

    for (const file of files) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.name)
          .pipe(zip)
          .on('finish', resolve)
          .on('error', reject);
      });
    }

    const manifestBuffer = Buffer.from(manifest, 'utf8');
    await new Promise((resolve, reject) => {
      zip.write(manifestBuffer, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return zip.read();
  }
}

export { TaskbookPack };
