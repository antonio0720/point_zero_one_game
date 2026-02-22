import * as fs from 'fs';
import * as path from 'path';
import { createTree } from '@nx/devkit/tree';
import { readJsonFileSync } from './json-file';
import { Config, ProjectConfig } from '../config';

interface ValidationResult {
success: boolean;
errors?: string[];
}

function validateStructure(config: Config): ValidationResult {
const { root, projects } = config;
const validatedProjects: Record<string, ProjectConfig> = {};

fs.readdirSync(root).forEach((projectName) => {
const projectPath = path.join(root, projectName);
if (fs.lstatSync(projectPath).isDirectory()) {
const projectJsonPath = path.join(projectPath, 'project.json');
if (!fs.existsSync(projectJsonPath)) {
return;
}

try {
const projectConfig: ProjectConfig = readJsonFileSync<ProjectConfig>(projectJsonPath);
validatedProjects[projectName] = projectConfig;
} catch (error) {
console.error(`Error reading project ${projectName}'s config file:`, error);
}
}
});

const missingProjects = Object.keys(projects).filter((projectName) => !validatedProjects[projectName]);
if (missingProjects.length > 0) {
return {
success: false,
errors: [`Missing the following projects in the monorepo: ${missingProjects.join(', ')}`],
};
}

return { success: true };
}

function main() {
const configPath = path.join(process.cwd(), 'nx.json');
const config = readJsonFileSync<Config>(configPath);
const result = validateStructure(config);
if (!result.success) {
console.error('Structure validation failed:', ...result.errors);
process.exitCode = 1;
}
}

main();
