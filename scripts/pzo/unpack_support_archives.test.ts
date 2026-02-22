import { describe, it, expect } from 'vitest';
import { unpackSupportArchives } from '../unpack_support_archives';

describe('Unpack script contract', () => {
  it('should be idempotent', async () => {
    const input = {
      archive: 'path/to/archive.zip',
      output: 'path/to/output',
    };
    await unpackSupportArchives(input);
    expect(await unpackSupportArchives(input)).toBeUndefined();
  });

  it('should strip __MACOSX directory', async () => {
    const input = {
      archive: 'path/to/archive.zip',
      output: 'path/to/output',
    };
    const originalContents = await fs.readdirSync(input.output);
    await unpackSupportArchives(input);
    const newContents = await fs.readdirSync(input.output);
    expect(newContents).not.toContain('__MACOSX');
  });

  it('should count 150 mechanics + 150 ml', async () => {
    const input = {
      archive: 'path/to/archive.zip',
      output: 'path/to/output',
    };
    const originalCount = await fs.readdirSync(input.output).length;
    await unpackSupportArchives(input);
    const newCount = await fs.readdirSync(input.output).length;
    expect(newCount - originalCount).toBe(300);
  });

  it('should emit manifest', async () => {
    const input = {
      archive: 'path/to/archive.zip',
      output: 'path/to/output',
    };
    const originalManifest = await fs.readFileSync(`${input.output}/manifest.json`, 'utf8');
    await unpackSupportArchives(input);
    const newManifest = await fs.readFileSync(`${input.output}/manifest.json`, 'utf8');
    expect(newManifest).not.toBe(originalManifest);
  });
});
