import crypto from 'crypto';

class AntiCheatSystem {
private static instance: AntiCheatSystem;
private blacklistedHashes: Set<string>;
private salt: string;

private constructor() {
this.blacklistedHashes = new Set();
this.salt = process.env.SALT || 'random_salt';
}

static getInstance(): AntiCheatSystem {
if (!AntiCheatSystem.instance) {
AntiCheatSystem.instance = new AntiCheatSystem();
}
return AntiCheatSystem.instance;
}

generateSaltedHash(data: string): string {
const hash = crypto.createHash('sha256');
hash.update(`${this.salt}:${data}`);
return hash.digest('hex');
}

verifyIntegrityAndPreventCheating(data: string, allowedHashes?: string[]): boolean {
const generatedHash = this.generateSaltedHash(data);
if (allowedHashes && allowedHashes.includes(generatedHash)) {
return true;
}

// If the hash is not in the allowed list, check against blacklist
if (this.blacklistedHashes.has(generatedHash)) {
return false;
}

// Add the new hash to the blacklist for future comparisons
this.blacklistedHashes.add(generatedHash);
console.log(`Blacklisted hash: ${generatedHash}`);
return false;
}

addAllowedHash(hash: string) {
this.blacklistedHashes.delete(hash);
}
}
