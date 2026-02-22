import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { npmPackageJsonDiff } from 'npm-package-json-diff';

const lernaRoot = process.cwd();
const packagesJSONPath = path.join(lernaRoot, 'packages', '*.json');

function readJSONFileSync(filePath: string) {
return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function generateSBOM() {
const packageJsonList = fs.readdirSync(lernaRoot).map((name) => path.join(lernaRoot, name, 'package.json')).filter(
(filePath) => fs.statSync(filePath).isFile(),
);

let sbom: Record<string, any> = {};

for (const packageJson of packageJsonList) {
const pkgData = readJSONFileSync(packageJson);
if (!sbom[pkgData.name]) {
sbom[pkgData.name] = { dependencies: {}, devDependencies: {} };
}

Object.assign(sbom[pkgData.name].dependencies, pkgData.dependencies || {});
Object.assign(sbom[pkgData.name].devDependencies, pkgData.devDependencies || {});
}

const latestLockfileVersion = await getLatestLockFileVersion();

for (const packageJson of packageJsonList) {
try {
const lockfilePath = path.join(path.dirname(packageJson), 'node_modules', '.npm-' + latestLockfileVersion, 'package-lock.json');
if (fs.existsSync(lockfilePath)) {
const lockData = readJSONFileSync(lockfilePath);
Object.keys(lockData.dependencies).forEach((depName) => {
if (!sbom[depName]) {
sbom[depName] = { dependencies: {}, devDependencies: {} };
}

const depLockData = lockData.dependencies[depName];
Object.assign(sbom[depName].dependencies, depLockData.requires || {});
});
}
} catch (err) {
console.error(`Error reading lockfile for ${path.basename(packageJson)}:`, err);
}
}

const sbomFile = fs.createWriteStream('sbom.json');
sbomFile.write(JSON.stringify(sbom, null, 2));
sbomFile.end();
}

function getLatestLockFileVersion() {
return execSync('ls node_modules/.npm-* -drt').toString().trim().split('/')[1];
}

generateSBOM();
