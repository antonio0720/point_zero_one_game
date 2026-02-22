import { execSync } from 'child_process';
import spdx from 'spdx-license-ids';

// Get project dependencies with their licenses
const packageJson = JSON.parse(execSync('npm json').toString());
let dependencies = Object.keys(packageJson.dependencies || {}).reduce((acc, key) => {
const license = spdx[packageJson.dependencies[key]].type_id;
acc.push({ name: key, license });
return acc;
}, []);

// Get devDependencies with their licenses
const devDependencies = Object.keys(packageJson.devDependencies || {}).reduce((acc, key) => {
const license = spdx[packageJson.devDependencies[key]].type_id;
acc.push({ name: key, license });
return acc;
}, []);

// Merge dependencies and devDependencies into one array
const sbom = [...dependencies, ...devDependencies];

// Output the SBOM in JSON format
console.log(JSON.stringify(sbom, null, 2));
