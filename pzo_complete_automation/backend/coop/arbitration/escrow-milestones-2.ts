import { Contract, providers, ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy';

const DEPLOYMENT_BLOCK_CONFIRMATIONS = 6;

declare var hre: HardhatRuntimeEnvironment;

const FUNDING_START_BLOCK = 13000000;
const MILESTONE_1_RELEASE_AMOUNT = ethers.utils.parseEther('0.2');
const MILESTONE_2_RELEASE_AMOUNT = ethers.utils.parseEther('0.4');
const FUNDING_END_BLOCK = 16000000;

const ARBITRATOR_ADDRESS = '0xYourArbitratorAddress';

const escrowArtifact = artifacts.readArtifactSync('Escrow');

async function deployEscrow(name: string, contract: Contract) {
await hre.network.provider.request({
method: 'hardhat_impersonateAccount',
params: [hre.ethers.Wallet.createRandom().address],
});

const signer = hre.ethers.provider.getSigner(hre.ethers.Wallet.createRandom().address);
await contract.deploy(signer._addr, ARBITRATOR_ADDRESS).then((res) => res.wait(DEPLOYMENT_BLOCK_CONFIRMATIONS));
}

const deployFunctions: DeployFunction[] = [
{
async deployment(name, _args) {
const provider = new ethers.providers.JsonRpcProvider(hre.ethers.provider);
const accounts = await hre.ethers.getSigners();
const deployer = accounts[0];

const escrow = new Contract(escrowArtifact.address, escrowArtifact.abi, deployer);

await deployEscrow('Escrow', escrow);
},
},
];

const deployContracts = async () => {
for (let i of deployFunctions) {
await i.deployment('Escrow', []);
}
};

export default deployContracts;
