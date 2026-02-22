import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface Node {
file: ts.Node;
dependencies: Set<number>;
}

let nodeIdCounter = 1;
const rootNodes: Node[] = [];

function visit(node: ts.Node, parentNodeIndex?: number) {
const nodeId = nodeIdCounter++;
if (ts.isImportDeclaration(node)) {
const importedModule = node.moduleSpecificResolver?.getResolvedModuleName() || node.importClause?.name;
if (importedModule) {
rootNodes.push({ file: node, dependencies: new Set([nodeId]) });
fs.readFile(path.resolve(__dirname, importedModule + '.ts'), 'utf8', (err, data) => {
if (err) throw err;
const sourceFile = ts.createSourceFile(importedModule + '.ts', data, ts.ScriptTarget.Latest);
traverse(sourceFile);
});
}
} else if (node.getChildren()) {
node.getChildren().forEach((child) => visit(child, nodeId));
}

if (parentNodeIndex !== undefined) {
rootNodes[parentNodeIndex].dependencies!.add(nodeId);
}
}

function traverse(sourceFile: ts.SourceFile) {
sourceFile.forEachChild((node) => visit(node));
}

const program = ts.createProgram([path.resolve(__dirname, '.'), path.resolve(__dirname, 'example-package')], {});
traverse(program.getSourceFiles()[0]);

// Now you can generate the dependency graph using rootNodes array
