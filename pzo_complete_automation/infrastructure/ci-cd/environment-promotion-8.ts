import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname);
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const STAGE_ENV_FILE = path.join(PROJECT_ROOT, `.env.${process.env.CI_PIPELINE_PHASE}`);

function readFile(filePath: string) {
return new Promise((resolve, reject) => {
fs.readFile(filePath, 'utf8', (err, data) => {
if (err) return reject(err);
resolve(data);
});
});
}

function writeFile(filePath: string, content: string) {
return new Promise((resolve, reject) => {
fs.writeFile(filePath, content, err => {
if (err) return reject(err);
resolve();
});
});
}

async function promoteEnvironment() {
console.log('Reading existing environment variables...');
const envContent = await readFile(ENV_FILE);

console.log('Creating stage-specific environment file...');
await writeFile(STAGE_ENV_FILE, envContent);

console.log(`Setting environment variables from ${STAGE_ENV_FILE}...`);
child_process.execSync(`source ${STAGE_ENV_FILE}`);

console.log('Environment promotion completed.');
}

promoteEnvironment().catch(console.error);
