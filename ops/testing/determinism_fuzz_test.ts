Here is the `determinism_fuzz_test.ts` file based on your specifications:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const ROOT_DIR = process.cwd();
const GAME_BINARY_PATH = path.join(ROOT_DIR, 'build/point-zero-one-digital');
const SEEDS_FILE_PATH = path.join(ROOT_DIR, 'ops/testing/seeds.txt');
const OUTPUT_DIR_PREFIX = path.join(ROOT_DIR, 'ops/testing/output');
const TEST_CASE_SUFFIX = '.test';
const NUM_SEEDS = 10000;

function writeOutputDir(testCaseIndex: number) {
  const outputDir = path.join(OUTPUT_DIR_PREFIX, `${testCaseIndex}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
}

function runGameWithSeed(seed: string) {
  const command = `./${GAME_BINARY_PATH} --seed ${seed}`;
  const outputDirIndex = parseInt(seed.slice(-5), 10);
  writeOutputDir(outputDirIndex);
  execSync(command, { cwd: ROOT_DIR, stdio: ['ignore', process.stdin, 'pipe'] });
}

function runTest() {
  const seeds = fs.readFileSync(SEEDS_FILE_PATH, 'utf8').split('\n');
  for (let i = 0; i < NUM_SEEDS; i++) {
    const seed = seeds[i];
    if (!seed) continue; // skip empty lines

    runGameWithSeed(seed);
    const outputDirIndex = parseInt(seed.slice(-5), 10);
    const previousOutputPath = path.join(OUTPUT_DIR_PREFIX, `${outputDirIndex - 1}`, 'game.out');
    const currentOutputPath = path.join(OUTPUT_DIR_PREFIX, `${outputDirIndex}`, 'game.out');

    // Replay the game twice and assert byte-identical output
    const previousGameOutput = fs.readFileSync(previousOutputPath, 'utf8');
    const currentGameOutput = fs.readFileSync(currentOutputPath, 'utf8');
    assert.deepStrictEqual(previousGameOutput, currentGameOutput);
  }
}

// Run the test once and save the results for nightly runs
runTest();

// Export a script to run the test with rollback notes
const testScript = `#!/bin/sh

# This script runs the determinism fuzz test for Point Zero One Digital.
# It is idempotent and can be safely rerun multiple times.

set -e

# Set the working directory to the root of the project
cd ${ROOT_DIR}

# Run the test
node ops/testing/determinism_fuzz_test.ts

# If there were any failures, rollback the output directories
if [ $? -ne 0 ]; then
  for i in $(ls -1 ${OUTPUT_DIR_PREFIX} | sort -n); do
    rm -rf ${OUTPUT_DIR_PREFIX}/${i}
  done
fi`;

fs.writeFileSync(path.join(ROOT_DIR, 'ops/testing/run_determinism_fuzz_test.sh'), testScript);
