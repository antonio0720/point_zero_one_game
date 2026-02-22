import { expect } from 'chai';
import { EthereumAddress, keccak256, toHex } from '@ethersproject/utils';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeckFixture } from '../../../typechain-types';
import { createTestDeck } from '../../helpers/decks';
import { Prover, Verifier } from '../../../contracts';
import { getProofFromDeck, verifyProof } from '../../helpers/proofVerification';

const { deployments, ethers } = require('hardhat');

describe('Proof Generation 10', function () {
let fixture: DeckFixture;
let prover: Prover;
let verifier: Verifier;

beforeEach(async function () {
fixture = await deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
const [owner, user1, user2] = await ethers.getSigners();
return { owner, user1, user2 };
});

prover = await ethers.getContractFactory('Prover', fixture.signers);
verifier = await ethereum.getContractFactory('Verifier');
});

it('should generate and verify proof for deck with 10 cards', async function () {
const deck = createTestDeck(10);
const proverAddress = await prover.deploy();
await prover.setDeck(deck, proverAddress);
const proof = getProofFromDeck(proverAddress, deck);

const verifierInstance = await verifier.deploy();
expect(await verifyProof(verifierInstance, proverAddress, deck, proof)).to.be.true;
});

it('should fail to generate proof for non-existent deck', async function () {
const deckLength = 10;
const nonExistentDeck = [...Array(deckLength)].map(() => EthereumAddress.zero());
const proverInstance = await prover.deploy();

await expect(proverInstance.setDeck(nonExistentDeck, proverInstance.address)).to.be.rejected;
});

it('should fail to verify non-existent proof for valid deck', async function () {
const deck = createTestDeck(10);
const proverAddress = await prover.deploy();
await prover.setDeck(deck, proverAddress);
const invalidProof = keccak256(toHex(ethers.constants.HashZero));

const verifierInstance = await verifier.deploy();
await expect(verifyProof(verifierInstance, proverAddress, deck, invalidProof)).to.be.false;
});
});
