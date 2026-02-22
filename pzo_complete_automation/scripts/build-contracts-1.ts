import { HardhatProjectConfig } from 'hardhat/config';
import { join } from 'path';
import { ensureDir, readJson, writeFile, readFile } from 'fs-extra';
import { globbySync } from 'globby';

const config: HardhatProjectConfig = {
defaultNetwork: 'hardhat',
networks: {},
solidity: {
compilers: [
{
version: "0.8.4",
settings: {
optimizer: {
enabled: true,
runs: 200
}
}
},
{
version: "0.6.6",
settings: {
optimizer: {
enabled: true,
runs: 200
}
}
}
]
}
};

(async () => {
const contractsPath = join(__dirname, '../contracts');
const artifactsPath = join(__dirname, '../artifacts');
await ensureDir(artifactsPath);

const contractFiles = globbySync('**/*.sol', { cwd: contractsPath });

for (const file of contractFiles) {
const contractName = file.replace('.sol', '');
const artifactPath = join(artifactsPath, `${contractName}.json`);

if (!await hasArtifact(artifactPath)) {
console.log(`Compiling and deploying ${contractName}`);
await hardhat(['compile'], { cwd: contractsPath });
const compiledContracts = readJsonSync(join(contractsPath, 'abi.json'));

if (compiledContracts[contractName]) {
await hardhat(['hardhat', 'deploy', contractName], {
cwd: contractsPath,
silent: true
});

const artifact = readJsonSync(join(contractsPath, `${contractName}.json`));
writeFile(artifactPath, JSON.stringify(artifact, null, 2));
} else {
console.error(`Contract ${contractName} not found in abi.json`);
}
}
}
})();

function readJsonSync(file: string) {
const json = readFileSync(file, 'utf-8');
return JSON.parse(json);
}

function hasArtifact(file: string) {
try {
readFileSync(file, 'utf-8');
return true;
} catch (error) {
if (error.code === 'ENOENT') return false;
throw error;
}
}
