import { Contract } from 'ethers';
import { ethers } from 'hardhat';

export interface VotingContract extends Contract {
vote(proposalId: number, support: boolean): Promise<void>;
proposalCount(): Promise<number>;
getProposal(proposalId: number): Promise<string[]>;
getVoteCounts(proposalId: number): Promise<[number, number]>;
}

export async function getContract(address: string): Promise<VotingContract> {
const contract = new ethers.Contract(address, votingABI, ethers.provider);
return contract as VotingContract;
}

const votingABI = [
{
"inputs": [],
"stateMutability": "nonpayable",
"type": "constructor"
},
{
"inputs": [
{
"internalType": "uint256",
"name": "_proposalId",
"type": "uint256"
},
{
"internalType": "bool",
"name": "_support",
"type": "bool"
}
],
"name": "vote",
"outputs": [],
"stateMutability": "nonpayable",
"type": "function"
},
{
"inputs": [],
"name": "proposalCount",
"outputs": [
{
"internalType": "uint256",
"name": "",
"type": "uint256"
}
],
"stateMutability": "view",
"type": "function"
},
{
"inputs": [
{
"internalType": "uint256",
"name": "_proposalId",
"type": "uint256"
}
],
"name": "getProposal",
"outputs": [
{
"internalType": "string[]",
"name": "",
"type": "string[]"
}
],
"stateMutability": "view",
"type": "function"
},
{
"inputs": [
{
"internalType": "uint256",
"name": "_proposalId",
"type": "uint256"
}
],
"name": "getVoteCounts",
"outputs": [
{
"internalType": "uint256",
"name": "for",
"type": "uint256"
},
{
"internalType": "uint256",
"name": "against",
"type": "uint256"
}
],
"stateMutability": "view",
"type": "function"
}
];
