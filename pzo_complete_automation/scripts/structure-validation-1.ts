import fs from 'fs-extra';
import path from 'path';
import { GlobSync } from 'glob-sync';
import chalk from 'chalk';

const ROOT = process.cwd();
const SOURCE_OF_TRUTH = path.join(ROOT, 'src', 'structure.json');

interface Node {
name: string;
type: 'directory' | 'file';
children?: Node[];
}

function readDirectory(dirPath: string): Promise<Node[]> {
const files = await fs.readdir(dirPath);
return Promise.all(
files.map((file) => {
const filePath = path.join(dirPath, file);
return fs.stat(filePath).then((stats) => {
if (stats.isDirectory()) {
return { name: file, type: 'directory', children: [] };
}
return { name: file, type: 'file' };
});
})
).then((promises) => Promise.all(promises).map((node) => node as Node));
}

async function buildTree(dirPath: string): Promise<Node> {
const nodes = await readDirectory(dirPath);
const rootNode: Node = { name: path.basename(dirPath), type: 'directory' };
rootNode.children = nodes;
nodes.forEach((node) => {
if (node.type === 'directory') {
buildTree(path.join(dirPath, node.name));
}
});
return rootNode;
}

async function compareTrees(expected: Node, actual: Node): Promise<boolean> {
if (expected.name !== actual.name) return false;

if (expected.type === 'directory') {
if (actual.type !== 'directory') return false;
if (actual.children.length !== expected.children.length) return false;

const sortedExpectedChildren = expected.children.sort((a, b) => a.name.localeCompare(b.name));
const sortedActualChildren = actual.children.sort((a, b) => a.name.localeCompare(b.name));

for (let i = 0; i < sortedExpectedChildren.length; ++i) {
if (!(await compareTrees(sortedExpectedChildren[i], sortedActualChildren[i]))) return false;
}
return true;
}

// File comparison not implemented in this example
console.log(`File comparison is not supported yet`);
return true;
}

async function writeTree(tree: Node, filePath: string): Promise<void> {
await fs.ensureDir(path.dirname(filePath));
const jsonContent = JSON.stringify(tree, null, 2);
await fs.writeFile(filePath, jsonContent);
}

function getGlobPattern(dir: string): string {
return `${path.join(ROOT, '**')}/${dir}`;
}

async function initStructure(): Promise<void> {
const structure = await buildTree(path.join(ROOT, 'src'));
await writeTree(structure, SOURCE_OF_TRUTH);
}

function validateStructure(): void {
GlobSync(getGlobPattern('src'))
.map((dir) => path.basename(dir))
.forEach((dir) => {
const expectedPath = path.join(ROOT, 'src', dir, 'structure.json');
const actualPath = path.join(ROOT, 'src', dir);
const isExpectedFileExists = fs.existsSync(expectedPath);
const isActualDirectory = fs.lstatSync(actualPath).isDirectory();

if (isExpectedFileExists && !isActualDirectory) {
console.log(chalk.red(`Error: ${expectedPath} does not exist as a directory`));
} else if (!isExpectedFileExists && isActualDirectory) {
console.log(chalk.red(`Warning: ${actualPath} exists as a directory but has no corresponding structure file`));
}
});
}

initStructure().then(() => validateStructure());
