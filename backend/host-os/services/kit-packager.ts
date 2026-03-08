// /Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/backend/host-os/services/kit-packager.ts

import { execFile } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface Asset {
  src?: string;
  dest: string;
  content?: Buffer | string;
}

export interface KitPackagerOptions {
  hostName: string;
  assetsRoot?: string;
  archiveName?: string;
}

const DEFAULT_ARCHIVE_NAME = 'pzo_host_os_kit_v1.zip';
const START_HERE_FILE = '00_START_HERE.md';

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

function sanitizeArchivePath(dest: string): string {
  const normalized = dest.replace(/\\/g, '/').replace(/^\/+/, '');

  if (!normalized || normalized.includes('..')) {
    throw new Error(`Invalid archive path: ${dest}`);
  }

  return normalized;
}

function walkFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

export function getAssets(
  assetsRoot: string = path.join(__dirname, '..', 'assets'),
): Asset[] {
  const files = walkFiles(assetsRoot);

  return files.map((absolutePath) => ({
    src: absolutePath,
    dest: toPosixPath(path.relative(assetsRoot, absolutePath)),
  }));
}

export function personalizeStartHereFile(
  hostName: string,
  startHereContent: Buffer,
): Buffer {
  const resolvedHostName = hostName.trim() || 'Host';

  const text = startHereContent.toString('utf8').replace(
    /\{\{\s*HOST_NAME\s*\}\}|__HOST_NAME__|\bHOST_NAME\b/g,
    resolvedHostName,
  );

  return Buffer.from(text, 'utf8');
}

async function materializeAssets(
  stagingDir: string,
  assets: readonly Asset[],
): Promise<void> {
  for (const asset of assets) {
    const archivePath = sanitizeArchivePath(asset.dest);
    const destinationPath = path.join(stagingDir, archivePath);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });

    if (asset.content !== undefined) {
      await fs.writeFile(destinationPath, asset.content);
      continue;
    }

    if (!asset.src) {
      throw new Error(`Asset is missing both src and content: ${asset.dest}`);
    }

    await fs.copyFile(asset.src, destinationPath);
  }
}

async function zipDirectory(
  sourceDir: string,
  archivePath: string,
): Promise<void> {
  try {
    await execFileAsync('zip', ['-rq', archivePath, '.'], {
      cwd: sourceDir,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown zip failure';

    throw new Error(
      `Failed to build host kit archive with system zip command: ${message}`,
    );
  }
}

function buildDefaultStartHere(hostName: string): Buffer {
  const content = [
    '# Point Zero One — Host OS Kit',
    '',
    `Welcome, ${hostName.trim() || 'Host'}.`,
    '',
    'This kit was generated for Host OS distribution.',
    '',
    'Contents:',
    '- Printable assets',
    '- Starter instructions',
    '- Operational references',
    '',
    'Keep this package synchronized with your current Host OS flow.',
    '',
  ].join('\n');

  return Buffer.from(content, 'utf8');
}

export async function packKit(
  assets: readonly Asset[],
  archiveName: string = DEFAULT_ARCHIVE_NAME,
): Promise<Buffer> {
  const workspaceDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'pzo-host-os-kit-'),
  );
  const stagingDir = path.join(workspaceDir, 'payload');
  const archivePath = path.join(workspaceDir, archiveName);

  try {
    await fs.mkdir(stagingDir, { recursive: true });
    await materializeAssets(stagingDir, assets);
    await zipDirectory(stagingDir, archivePath);
    return await fs.readFile(archivePath);
  } finally {
    await fs.rm(workspaceDir, {
      recursive: true,
      force: true,
    });
  }
}

export async function kitPackager(
  hostName: string,
  options: Partial<Omit<KitPackagerOptions, 'hostName'>> = {},
): Promise<Buffer> {
  const assetsRoot = options.assetsRoot || path.join(__dirname, '..', 'assets');
  const discoveredAssets = getAssets(assetsRoot);
  const assets = [...discoveredAssets];

  const startHereIndex = assets.findIndex(
    (asset) => path.posix.basename(asset.dest) === START_HERE_FILE,
  );

  if (startHereIndex >= 0) {
    const sourcePath = assets[startHereIndex].src;
    const sourceBuffer = sourcePath
      ? readFileSync(sourcePath)
      : buildDefaultStartHere(hostName);

    assets[startHereIndex] = {
      dest: assets[startHereIndex].dest,
      content: personalizeStartHereFile(hostName, sourceBuffer),
    };
  } else {
    assets.unshift({
      dest: START_HERE_FILE,
      content: buildDefaultStartHere(hostName),
    });
  }

  return await packKit(
    assets,
    options.archiveName || DEFAULT_ARCHIVE_NAME,
  );
}

export default kitPackager;