import { readFileSync, writeFileSync } from 'fs';
import * as ts from 'typescript';
import * as Lerna from 'lerna';

const lerna = new Lerna();
const config = lerna.config;
const projectRe = new RegExp(`^${config.projectRoot}`);

interface DependencyGraph {
name: string;
dependencies: Record<string, string[]>;
}

function parseDependencies(node: ts.Node): Record<string, string[]> {
const result = {} as any;

function visit(node: ts.Node) {
if (ts.isImportDeclaration(node)) {
const source = node.moduleSpecificResolver?.getSourceFile(node).getName();
if (source && !result[source]) {
result[source] = [];
}
if (result[source]) {
result[source].push(node.importClause?.namedBindings?.elements?.[0]?.name?.text);
}
} else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
visit(node.expression);
const propertyName = node.propertyName.getText();
if (propertyName === 'require') {
visit(node.arguments[0]);
}
}

ts.visitEachChild(node, visit, context);
}

const context: any = {};
context.system = true;
visit(ts.createSourceFile('', '', ts.ScriptTarget.Latest));

return result;
}

async function getProjectDependencies(projectName: string) {
const project = config.getPackage(projectName);
if (!project) {
throw new Error(`No such project: ${projectName}`);
}

const projectRoot = project.location as string;
const tsConfigPath = path.join(projectRoot, 'tsconfig.json');
const sourceMapFile = path.join(projectRoot, 'src', 'main.ts');
const tsConfigJson = JSON.parse(readFileSync(tsConfigPath).toString());
const program = ts.createProgram([sourceMapFile], tsConfigJson);

return parseDependencies(program.getSourceFiles().find((sf) => sf.fileName === sourceMapFile)!);
}

async function buildDependencyGraph() {
const packageJsonPath = path.join(config.root, 'package.json');
const pkgData = JSON.parse(readFileSync(packageJsonPath).toString());
const allDependencies: Record<string, string[]> = {};

for (const [name, pkg] of Object.entries(pkgData.dependencies)) {
if (!projectRe.test(name)) continue;
allDependencies[name] = [];

const deps = await getProjectDependencies(name);
Object.assign(allDependencies[name], deps);
}

let graph: DependencyGraph[] = [];
for (const name in allDependencies) {
const dependencies = allDependencies[name];
graph.push({ name, dependencies });
}

return graph;
}

buildDependencyGraph().then((graph) => {
writeFileSync(
path.join(config.root, 'dependency-graph.json'),
JSON.stringify(graph, null, 2)
);
});
