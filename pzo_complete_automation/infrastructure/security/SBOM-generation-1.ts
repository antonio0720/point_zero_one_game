import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { execSync } from 'child_process';

function generateNpmSbom(outputFile: string) {
try {
const output = execSync('npm list --json', { encoding: 'utf8' });
fs.writeFileSync(outputFile, output);
console.log(chalk.green(`Generated npm SBOM at ${outputFile}`));
} catch (error) {
console.error(chalk.red(`Failed to generate npm SBOM: ${error}`));
}
}

function generateYarnSbom(outputFile: string) {
try {
const output = execSync('yarn list --json > ' + path.join(__dirname, outputFile), { encoding: 'utf8' });
console.log(chalk.green(`Generated yarn SBOM at ${outputFile}`));
} catch (error) {
console.error(chalk.red(`Failed to generate yarn SBOM: ${error}`));
}
}

const npmSbom = 'npm-sbom.json';
const yarnSbom = 'yarn-sbom.json';

generateNpmSbom(npmSbom);
generateYarnSbom(yarnSbom);
