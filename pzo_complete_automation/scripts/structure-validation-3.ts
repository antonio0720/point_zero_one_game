import * as fs from 'fs';
import * as path from 'path';
import { Tree } from '@angular-builders/ptasks';

const ROOT = process.cwd();
const SOURCE_OF_TRUTH = path.join(ROOT, '.soa', 'structure.json');

function readSoa(): Tree {
const data = JSON.parse(fs.readFileSync(SOURCE_OF_TRUTH, 'utf8'));
return new Tree(data);
}

function validateStructure(tree: Tree) {
tree.visit((node) => {
if (node.type === 'directory') {
const dirPath = path.join(ROOT, node.path);
if (!fs.existsSync(dirPath)) {
console.error(`Missing directory: ${node.path}`);
return false;
}
} else if (node.type === 'file') {
const filePath = path.join(ROOT, node.path);
if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) {
console.error(`Missing or incorrect type for file: ${node.path}`);
return false;
}
}
return true;
});

if (tree.root !== '/') {
console.error('Root of the SOA tree should be "/"');
return false;
}

return true;
}

function main() {
const soaTree = readSoa();
if (!validateStructure(soaTree)) process.exitCode = 1;
}

main();
