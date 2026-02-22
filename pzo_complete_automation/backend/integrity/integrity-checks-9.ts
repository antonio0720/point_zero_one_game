import * as crypto from 'crypto';
import * as fs from 'fs';

const dataFilePath = './data.json';
const dataFileHash: string = 'YOUR_STORED_FILE_HASH'; // Replace this with the stored hash of your data file

function readFileAsBuffer(filePath: string): Promise<Buffer> {
return new Promise((resolve, reject) => {
fs.readFile(filePath, (err, buffer) => {
if (err) {
reject(err);
} else {
resolve(buffer);
}
});
});
}

function calculateFileHash(data: Buffer): Promise<string> {
return new Promise((resolve, reject) => {
crypto.createHash('sha256').update(data, (err, hash) => {
if (err) {
reject(err);
} else {
resolve(hash.digest('hex'));
}
});
});
}

async function checkFileIntegrity() {
try {
const fileData = await readFileAsBuffer(dataFilePath);
const calculatedHash = await calculateFileHash(fileData);

if (calculatedHash === dataFileHash) {
console.log('File integrity is OK');
} else {
console.log('File integrity is compromised');
}
} catch (error) {
console.error(`Error checking file integrity: ${error}`);
}
}

checkFileIntegrity();
