import * as readline from 'readline';
import * as child_process from 'child_process';

const rl = readline.createInterface({
input: process.stdin,
output: process.stdout
});

function rollback(version: string) {
const command = `npm run release:down ${version}`;
child_process.execSync(command);
}

rl.question('Enter the version to rollback: ', (version) => {
rollback(version);
console.log(`Rolled back to version: ${version}`);
rl.close();
});
