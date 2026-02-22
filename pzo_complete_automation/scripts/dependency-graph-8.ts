import fs from 'fs';
import path from 'path';

interface Node {
name: string;
dependencies: Set<string>;
}

const root = process.cwd();
const nodes: Record<string, Node> = {};
let currentNodeName: string | null = null;

function traverse(dirPath: string) {
const files = fs.readdirSync(dirPath);

for (const file of files) {
const filePath = path.join(dirPath, file);
const stat = fs.lstatSync(filePath);

if (stat.isDirectory()) {
const node: Node = { name: file, dependencies: new Set() };
nodes[node.name] = node;

if (currentNodeName) {
nodes[currentNodeName].dependencies.add(file);
}

currentNodeName = file;
traverse(filePath);
} else if (stat.isFile() && path.extname(file) === '.ts') {
const relativePathToRoot = path.relative(root, filePath).replace(/\\/g, '/');
const importPath = `./${relativePathToRoot}`;

try {
const imports = require.resolveSync(importPath);
const dirName = path.dirname(imports);
const relativeDirPathToRoot = path.relative(root, dirName).replace(/\\/g, '/');

if (currentNodeName && !nodes[currentNodeName].dependencies.has(relativeDirPathToRoot)) {
nodes[currentNodeName].dependencies.add(relativeDirPathToRoot);
}
} catch (err) {}
}
}
}

traverse(root);

// Print the dependency graph (replace with your preferred output method)
for (const node of Object.values(nodes)) {
console.log(`Node: ${node.name}`);
console.log(`Dependencies: ${Array.from(node.dependencies).join(', ')}`);
}
