// @ts-check

import { join } from 'path';
import * as fs from 'fs-extra';
import * as parquet from 'parquetjs-lite';
import * as csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';

interface SimData {
  audit_hash: string;
  ml_enabled: boolean;
  bounded_output: number;
}

const SIM_COUNT = 1000;

async function generateSimulations() {
  const sims: SimData[] = [];

  for (let i = 0; i < SIM_COUNT; i++) {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const sim = await runSimulation(seed);

    if (!sim) continue;

    sims.push(sim);
  }

  return sims;
}

async function runSimulation(seed: number): Promise<SimData | null> {
  // Simulate game logic here
  // For demonstration purposes, we'll just generate some random data
  const boundedOutput = Math.random();
  const auditHash = uuidv4();

  if (boundedOutput < 0 || boundedOutput > 1) return null;

  return { audit_hash: auditHash, ml_enabled: true, bounded_output: boundedOutput };
}

async function writeParquet(sims: SimData[]) {
  const filePath = join(__dirname, 'data.parquet');
  const schema = parquet.schema({
    fields: [
      { name: 'audit_hash', type: 'string' },
      { name: 'ml_enabled', type: 'boolean' },
      { name: 'bounded_output', type: 'float' },
    ],
  });

  const writer = new parquet.Writer(schema);
  await writer.write(sims);

  await fs.promises.writeFile(filePath, writer.toBuffer());
}

async function writeCsv(sims: SimData[]) {
  const filePath = join(__dirname, 'data.csv');
  const csvWriter = fs.createWriteStream(filePath);

  sims.forEach((sim) => {
    csvWriter.write(`${sim.audit_hash},${sim.ml_enabled},${sim.bounded_output}\n`);
  });

  await new Promise((resolve, reject) => {
    csvWriter.on('finish', resolve);
    csvWriter.on('error', reject);
  });
}

async function main() {
  const sims = await generateSimulations();

  if (sims.length === 0) return;

  await writeParquet(sims);
  await writeCsv(sims);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
