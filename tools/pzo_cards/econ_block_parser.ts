// tslint:disable:no-any strict-type-checking no-empty-interface
import * as path from 'path';
import { EOL } from 'os';

export interface EconBlock {
  name: string;
  description?: string;
  type: string;
  data: any[];
}

const mlEnabled = false;

function parseEconBlock(block: string): EconBlock | null {
  try {
    const json = JSON.parse(block);
    if (!json.name || !json.type) {
      return null;
    }
    return { ...json, data: json.data.map((x) => typeof x === 'string' ? x : null) };
  } catch (e) {
    console.error(`Error parsing block at offset ${block.length}: ${e}`);
    return null;
  }
}

function stableHash(block: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(block);
  return hash.digest('hex');
}

export function parseEconBlockFile(filePath: string): EconBlock[] | null {
  try {
    const fileContent = fs.readFileSync(path.resolve(filePath), 'utf8').split(EOL);
    const blocks: EconBlock[] = [];
    let currentBlock: string[] = [];

    for (const line of fileContent) {
      if (line.trim().startsWith('```')) {
        if (currentBlock.length > 0) {
          const block = parseEconBlock(currentBlock.join('\n'));
          if (block !== null) {
            blocks.push(block);
          }
        }

        currentBlock = [];
      } else {
        currentBlock.push(line);
      }
    }

    if (currentBlock.length > 0) {
      const block = parseEconBlock(currentBlock.join('\n'));
      if (block !== null) {
        blocks.push(block);
      }
    }

    return blocks;
  } catch (e) {
    console.error(`Error reading file at path ${filePath}: ${e}`);
    return null;
  }
}

export function auditHash(filePath: string, blocks: EconBlock[]): string | null {
  if (!mlEnabled) {
    return null;
  }

  const hash = crypto.createHash('sha256');
  for (const block of blocks) {
    hash.update(JSON.stringify(block));
  }
  return hash.digest('hex');
}
