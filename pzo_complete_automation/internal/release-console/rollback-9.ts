import * as readline from 'readline';
import * as child_process from 'child_process';

const rl = readline.createInterface({
input: process.stdin,
output: process.stdout
});

function exec(command: string) {
return new Promise((resolve, reject) => {
const subprocess = child_process.spawn(command, ['rollback', '9']);

let result = '';

subprocess.stdout.on('data', (data: any) => result += data);
subprocess.stderr.on('data', (data: any) => console.error(data));
subprocess.on('close', (code: number) => {
if (code === 0) {
resolve(result);
} else {
reject(new Error(`Command ${command} failed with exit code ${code}`));
}
});
});
}

rl.question('Are you sure you want to rollback to version 9? (y/n) ', async (answer) => {
if (answer.toLowerCase() === 'y') {
try {
const result = await exec('your-rollback-script');
console.log(`Rollback to version 9 completed with output:\n${result}`);
} catch (error) {
console.error(error);
}
} else {
console.log('Rollback operation cancelled.');
}

rl.close();
});
