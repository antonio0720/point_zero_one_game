import * as fs from 'fs';
import * as path from 'path';

interface Mechanic {
id: number;
name: string;
description?: string;
}

function readMechanics(): Promise<Mechanic[]> {
return new Promise((resolve, reject) => {
const filePath = path.join(__dirname, 'mechanics.json');
fs.readFile(filePath, 'utf8', (err, data) => {
if (err) {
reject(err);
} else {
try {
const mechanics: Mechanic[] = JSON.parse(data);
resolve(mechanics);
} catch (error) {
reject(error);
}
}
});
});
}

async function main() {
try {
const mechanics = await readMechanics();

// Filter mechanics with a description longer than 50 characters
const filteredMechanics = mechanics.filter(mechanic => mechanic.description?.length > 50);

console.log(filteredMechanics);
} catch (error) {
console.error(`Error reading or parsing the mechanics file: ${error.message}`);
}
}

main();
