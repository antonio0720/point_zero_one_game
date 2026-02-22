import * as fs from 'fs';
import * as path from 'path';
import { readJsonFile } from './utilities/read-json-file';
import { writeJsonFile } from './utilities/write-json-file';
import { BatchOperation } from './batch-operation';
import { OperationType } from './operation-type';
import { Project, ProjectConfigurationTarget } from '@angular-devkit/schematics/angular';
import * as SchematicRunner from 'schematics-runner';
import { Chain } from 'schematics-chain';

const TEMPLATE_PROJECT = 'workspace.json';
const OUTPUT_PROJECT = 'workspace.json.output';
const TEMPLATE_CONFIGURATION = 'projects/my-app/angular.json';
const OUTPUT_CONFIGURATION = 'projects/my-app/angular.json.output';

interface ProjectWithTargets {
project: Project;
targets: ProjectConfigurationTarget[];
}

function readProject(projectFilePath: string): ProjectWithTargets {
const content = fs.readFileSync(projectFilePath, 'utf8');
return JSON.parse(content) as Project & { _allTargets: ProjectConfigurationTarget[] };
}

function applyOperationsToProject(project: Project, operations: BatchOperation<Project>[]): void {
const schematicRunner = new SchematicsRunner();

const chain = new Chain(operations.map((operation) => (context) => operation.apply(context)));
schematicRunner.run(chain, project);
}

function writeOutputFiles(outputProject: ProjectWithTargets): void {
fs.writeFileSync(OUTPUT_PROJECT, JSON.stringify(outputProject.project, null, 2));
outputProject.targets.forEach((target) => {
const targetPath = path.join('projects', outputProject.project.name, 'angular.json');
fs.writeFileSync(targetPath, JSON.stringify(target, null, 2));
});
}

function readOrCreateOutputFiles(): ProjectWithTargets {
const project = readJsonFile<Project>(TEMPLATE_PROJECT);
const targetNames = [...new Set(project._allTargets.map((t) => t.projectType))];
const targets: ProjectConfigurationTarget[] = [];

targetNames.forEach((targetName) => {
const target = project._allTargets.find((t) => t.projectType === targetName);
if (target) {
targets.push(target);
} else {
// Create a new target with default configurations
// ... (You can add your logic here to create the desired target)
}
});

return { project, targets };
}

function main(): void {
const operations: BatchOperation<Project>[] = [
// Add your batch operations here. For example:
new BatchOperation<Project>((context, next) => {
// Operation logic goes here. For example:
context.addSchema('@schematics/angular:component', { name: 'my-component' });
return next();
}, OperationType.Add),
];

const outputProject = readOrCreateOutputFiles();
applyOperationsToProject(outputProject.project, operations);
writeOutputFiles(outputProject);
}

main();
