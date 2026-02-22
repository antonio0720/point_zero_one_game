import * as child_process from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';

const releaseBranch = 'release';
const productionBranch = 'master'; // or 'main'
const currentBranch = process.env.GIT_BRANCH;
const releaseDirectory = '.tmp/release';
const gitCommand = 'git';

async function checkoutRelease() {
await child_process.execSync(`${gitCommand} checkout -f ${releaseBranch}`);
}

function isCurrentlyInRelease() {
return currentBranch === releaseBranch;
}

async function createReleaseDirectory() {
if (!await fs.pathExists(releaseDirectory)) {
await fs.mkdirp(releaseDirectory);
}
}

async function saveCurrentBranchToFile() {
await fs.writeFile(`${releaseDirectory}/current-branch`, currentBranch);
}

function getCurrentBranchFromFile(): string | null {
const filePath = path.join(releaseDirectory, 'current-branch');
if (fs.existsSync(filePath)) {
return fs.readFileSync(filePath).toString().trim();
}
return null;
}

async function rollback() {
if (!isCurrentlyInRelease()) {
console.error('Not currently in a release branch, cannot rollback.');
process.exit(1);
}

await checkoutRelease();
const currentBranchFromFile = getCurrentBranchFromFile();

if (!currentBranchFromFile) {
console.error("Couldn't find the 'current-branch' file in the release directory.");
process.exit(1);
}

await child_process.execSync(`${gitCommand} checkout -f ${currentBranchFromFile}`);
}

function main() {
createReleaseDirectory();
saveCurrentBranchToFile();

if (process.argv[2] === 'rollback') {
rollback();
}
}

main();
