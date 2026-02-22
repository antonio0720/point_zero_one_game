import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { format as prettyFormat } from 'prettier';
import { resolvePackages } from './sbom-utilities.js';

const rootDir = process.cwd();
const lernaJsonPath = path.join(rootDir, 'lerna.json');
const packageJsonPaths = (() => {
const packages: string[] = [];
execSync(`ls ${rootDir}/packages`, { encoding: 'utf8' });
fs.readdirSync(path.join(rootDir, 'packages')).forEach((packageName) => {
packages.push(path.join('packages', packageName, 'package.json'));
});
return packages;
})();

const sbom = resolvePackages(packageJsonPaths);
const outputPath = path.join(rootDir, 'sbom.json');
fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2), { encoding: 'utf8' });

// Add npm audit fix
execSync(`npm ci --only=prod`, { cwd: rootDir });
const auditReportPath = path.join(rootDir, 'audit-report.txt');
const auditReportContent = execSync(`npm audit fix --json`, { cwd: rootDir }).toString();
fs.writeFileSync(auditReportPath, auditReportContent);

// Add Prettier formatting for consistency across files
execSync('npx prettier --write "packages/**/*.{js,ts,json}"', { cwd: rootDir });
