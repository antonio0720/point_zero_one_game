import * as fs from 'fs';
import * as path from 'path';
import { Graph } from './graph';
import { PackageJsonReader } from './package-json-reader';

const ROOT_DIR = process.cwd();

function collectPackages(directory: string): Array<string> {
const packageJsonPath = path.join(directory, 'package.json');
if (!fs.existsSync(packageJsonPath)) return [];

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
const name = packageJson.name;

if (name.startsWith('@')) {
return [directory];
}

const dependencies = packageJson.dependencies || {};
const devDependencies = packageJson.devDependencies || {};

return Object.values(...Object.entries(dependencies).map(([key, value]) => collectPackages(value))).concat(
Object.values(...Object.entries(devDependencies).map(([key, value]) => collectPackages(value)))
);
}

function buildGraph(): Graph {
const packages = collectPackages(ROOT_DIR);
const graph = new Graph<string>();

for (const packageDir of packages) {
const reader = new PackageJsonReader(packageDir);
const packageName = reader.getName();
const dependencies = reader.getDependencies();

for (const [dependency, version] of Object.entries(dependencies)) {
graph.addEdge(packageName, dependency, version);
}
}

return graph;
}

const graph = buildGraph();
console.log(JSON.stringify(graph.toJson(), null, 2));
