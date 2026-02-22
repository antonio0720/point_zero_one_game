import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

interface Release {
version: string;
date: Date;
}

function readReleases(file: string): Release[] {
return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveRelease(releases: Release[], file: string) {
fs.writeFileSync(file, JSON.stringify(releases, null, 2));
}

function findLatestRelease(releases: Release[]): Release | undefined {
return releases.reduce((latest, release) => (release.date > latest?.date || !latest ? release : latest), undefined);
}

function getVersionAndDate(): Release {
const version = process.argv[2];
if (!version) {
throw new Error('Missing version parameter');
}

const date = new Date(process.argv[3] || Date.now());

return { version, date };
}

function askForConfirmation(question: string): boolean {
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
return new Promise<boolean>((resolve) =>
rl.question(`${question} (y/n)? `, (answer) => {
rl.close();
resolve(answer.toLowerCase() === 'y');
})
);
}

function rollback(releases: Release[], latestRelease: Release): void {
const previousRelease = releases.find((release) => release.date < latestRelease.date);

if (!previousRelease) {
console.error('No previous release found');
process.exit(1);
}

saveRelease([...releases.slice(0, releases.indexOf(latestRelease)), previousRelease], 'releases.json');
}

function main() {
const releases = readReleases('releases.json');
const latestRelease = findLatestRelease(releases);

if (!latestRelease) {
console.error('No released versions found');
process.exit(1);
}

const newVersionAndDate = getVersionAndDate();

if (newVersionAndDate.version === latestRelease.version) {
console.log(`Already at version ${latestRelease.version}`);
process.exit(0);
}

if (!askForConfirmation(`Are you sure you want to create a new release with version ${newVersionAndDate.version} and date ${newVersionAndDate.date.toISOString()}?`)) {
console.log('Operation cancelled');
process.exit(0);
}

releases.push(newVersionAndDate);
saveRelease(releases, 'releases.json');

if (askForConfirmation(`Do you want to rollback to the previous version ${previousRelease?.version}`)) {
rollback(releases, latestRelease);
}
}

main();
