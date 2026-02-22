import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const SBOM_FILE = path.join(ROOT_DIR, 'sbom.json');

function getPackageJsonDependencies(packageJsonPath: string): Record<string, string> {
const packageJsonContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
return packageJsonContent.dependencies || {};
}

function generateLernaPackagesSBOM(): Record<string, Record<string, string>> {
const lernaJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'lerna.json'), 'utf8'));
const packages = lernaJson.projects;

const sbom: Record<string, Record<string, string>> = {};
packages.forEach((pkg) => {
const packagePath = path.join(ROOT_DIR, pkg);
const packagePackageJson = path.join(packagePath, 'package.json');
const dependencies = getPackageJsonDependencies(packagePackageJson);

sbom[pkg] = dependencies;
});

return sbom;
}

function generateNpmSBOM(): Record<string, string> {
const cmd = 'npm list --depth=0';
const output = execSync(cmd).toString();
const lines = output.split('\n');
const sbom: Record<string, string> = {};

lines.forEach((line) => {
if (line.includes('@')) {
const [_, name, version] = line.match(/\s(\S+)\s(\S+)/);
sbom[name] = version;
}
});

return sbom;
}

function mergeSBOMs(): Record<string, string> {
const lernaSBOM = generateLernaPackagesSBOM();
const npmSBOM = generateNpmSBOM();

const mergedSBOM: Record<string, string> = {};
_.each(npmSBOM, (value, key) => {
if (!_.has(lernaSBOM, key)) {
mergedSBOM[key] = value;
} else {
mergedSBOM[key] = _.uniq([lernaSBOM[key][0], npmSBOM[key]])[0];
}
});

return mergedSBOM;
}

fs.writeFileSync(SBOM_FILE, JSON.stringify(mergeSBOMs(), null, 2));
