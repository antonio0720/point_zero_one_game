Here is the TypeScript file `backend/host-os/services/kit-packager.ts` as per your specifications:

```typescript
/**
 * KitPackager - Assembles pzo_host_os_kit_v1.zip on demand from /host-os/assets/, injects personalization (host name into 00_START_HERE.md), returns buffer
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { exec } from 'child_process';

export interface Asset {
  src: string;
  dest: string;
}

export function getAssets(): Asset[] {
  return [
    { src: path.join(__dirname, '..', 'assets', '00_START_HERE.md'), dest: '00_START_HERE.md' },
    // Add more assets as needed
  ].map((asset) => Object.freeze(asset));
}

export function personalizeStartHereFile(hostName: string, startHereContent: Buffer): Buffer {
  const personalizedContent = startHereContent.toString().replace(/HOST_NAME/g, hostName);
  return Buffer.from(personalizedContent);
}

export async function packKit(assets: Asset[]): Promise<Buffer> {
  const tempDir = path.join(os.tmpdir(), 'pzo_host_os_kit');
  await fs.promises.mkdir(tempDir, { recursive: true });

  for (const asset of assets) {
    const srcPath = asset.src;
    const destPath = path.join(tempDir, asset.dest);
    await fs.promises.copyFile(srcPath, destPath);
  }

  const tempZipPath = path.join(tempDir, 'pzo_host_os_kit_v1.zip');
  await exec(`cd ${tempDir} && zip -r ${tempZipPath} .`);

  const zipBuffer = await fs.promises.readFile(tempZipPath);
  await fs.promises.rmdir(tempDir, { recursive: true });
  await fs.promises.unlink(tempZipPath);

  return zipBuffer;
}

export function kitPackager(hostName: string): Promise<Buffer> {
  const assets = getAssets();
  const startHereContent = fs.readFileSync(assets[0].src);
  const personalizedStartHereContent = personalizeStartHereFile(hostName, startHereContent);
  return packKit([...assets, { src: personalizedStartHereContent, dest: '00_START_HERE.md' }]);
}
