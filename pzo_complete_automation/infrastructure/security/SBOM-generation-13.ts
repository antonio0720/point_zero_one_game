import * as fs from 'fs';
import * as path from 'path';
import * as npmFetch from 'npmfetch';
import { LernaProject } from 'lerna-project';

async function generateSBOM() {
const project = new LernaProject({ cwd: process.cwd(), depth: Infinity });
const sbom: any[] = [];

await project.traverse((pkg) => {
if (!pkg.lockfile) return;

npmFetch(pkg.lockfile, (err, data) => {
if (err) throw err;
const lockfile = JSON.parse(data);

Object.keys(lockfile.dependencies).forEach((depName) => {
const dep = lockfile.dependencies[depName];
sbom.push({
name: dep.name,
version: dep.version,
path: pkg.location,
});
});
});
});

fs.writeFileSync(
path.join(__dirname, 'sbom.json'),
JSON.stringify(sbom, null, 2)
);
}

generateSBOM();
