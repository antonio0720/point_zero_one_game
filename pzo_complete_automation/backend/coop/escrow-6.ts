import { ContractFactory, BigNumber, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { Contract } from '@ethersproject/contracts';

const COOP_ESCROW_ABI = [
// Your Coop Escrow ABI goes here...
];

const COOP_ESCROW_ADDRESS = '0xYourContractAddressHere';

async function deployEscrow(signer: Signer) {
const Escrow = await ethers.getContractFactory('CoopEscrow', signer);
return Escrow.attach(COOP_ESCROW_ADDRESS);
}

export default {
deployEscrow,
};
