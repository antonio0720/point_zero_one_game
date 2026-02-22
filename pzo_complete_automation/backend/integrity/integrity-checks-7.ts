import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type FileData = Buffer;
type HashAlgorithm = 'sha256' | 'md5';

function hashFile(filePath: string, algorithm: HashAlgorithm): Promise<string> {
return new Promise((resolve, reject) => {
const fileBuffer = fs.readFileSync(filePath);
const hash = crypto.createHash(algorithm);
hash.update(fileBuffer);
resolve(hash.digest('hex'));
});
}

function compareHashes(expectedHash: string, calculatedHash: string): boolean {
return expectedHash === calculatedHash;
}

async function checkFileIntegrity(filePath: string, expectedHash: string, algorithm: HashAlgorithm): Promise<boolean> {
try {
const calculatedHash = await hashFile(filePath, algorithm);
return compareHashes(expectedHash, calculatedHash);
} catch (error) {
console.error(`Error occurred while checking file integrity for ${filePath}:`, error);
return false;
}
}

function main() {
const filePath = path.join(__dirname, 'example-file');
const expectedHashAlgorithm = 'sha256';
const expectedIntegrityChecksum = 'YOUR_EXPECTED_INTEGRITY_CHECKSUM';

checkFileIntegrity(filePath, expectedIntegrityChecksum, expectedHashAlgorithm)
.then((isIntegrityIntact) => {
if (isIntegrityIntact) {
console.log('File integrity is intact.');
} else {
console.error('File integrity is compromised!');
}
})
.catch((error) => {
console.error('An error occurred during the file integrity check:', error);
});
}

main();
