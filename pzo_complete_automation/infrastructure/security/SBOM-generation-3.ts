import { execSync } from 'child_process';
import * as fs from 'fs';

const lernaLogin = () => {
execSync('npm login', {
stdio: 'inherit',
});
};

const generateLernaJson = () => {
const lernaJson = `{
"name": "your-monorepo",
"version": "0.1.0",
"private": true,
"network": {
"registry": "https://npm.pkg.github.com/"
},
"workspaces": [
"packages/*"
]
}`;
fs.writeFileSync('lerna.json', lernaJson);
};

const initLerna = () => {
execSync('npm install -g lerna', {
stdio: 'inherit',
});
};

const addWorkspace = (packageName: string) => {
execSync(`lerna bootstrap --hoist`, {
cwd: `packages/${packageName}`,
stdio: 'inherit',
});
};

const lernaAdd = (packageName: string) => {
execSync(`lerna add @types/jest jest`, {
cwd: `packages/${packageName}`,
stdio: 'inherit',
});
};

const createDependabotConfig = () => {
const config = `.github/dependabot.yml
version: 2
updates:
- package-ecosystem: npm
- directory: packages/
notifications:
email:
enabled: true
recipients:
- your-email@example.com
schedule:
weekdays: ['mon', 'tue', 'wed', 'thu', 'fri']
```;
fs.writeFileSync('.github/dependabot.yml', config);
};

const run = () => {
lernaLogin();
generateLernaJson();
initLerna();

// Add new packages to your monorepo
const packageNames = ['package1', 'package2'];
packageNames.forEach((packageName) => addWorkspace(packageName));
packageNames.forEach((packageName) => leraAdd(packageName));

createDependabotConfig();
};

run();
