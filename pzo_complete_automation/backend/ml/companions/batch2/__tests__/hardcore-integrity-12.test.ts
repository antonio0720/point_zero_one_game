import { HardcoreIntegrity12 } from '../hardcore-integrity-12';
import { expect } from 'expect';

describe('HardcoreIntegrity12', () => {
let hardcoreIntegrity12: HardcoreIntegrity12;

beforeEach(() => {
hardcoreIntegrity12 = new HardcoreIntegrity12();
});

it('should generate correct values for k', () => {
const k = hardcoreIntegrity12.generateK(10);
expect(k).toHaveLength(4);
expect(k[0]).toBeLessThanOrEqual(9);
expect(k[1]).toBeLessThanOrEqual(9);
expect(k[2]).toBeLessThanOrEqual(9);
expect(k[3]).toBeLessThanOrEqual(9);
});

it('should correctly check if two hashes are equal', () => {
const k = hardcoreIntegrity12.generateK(10);
const message1 = 'abcdefghijklmnopqrstuvwxyz';
const message2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const hash1 = hardcoreIntegrity12.hash(message1, k);
const hash2 = hardcaseIntegrity12.hash(message2, k);
expect(hardcoreIntegrity12.areHashesEqual(hash1, hash2)).toBeTruthy();
});

it('should correctly check if two hashes are not equal', () => {
const k = hardcoreIntegrity12.generateK(10);
const message1 = 'abcdefghijklmnopqrstuvwxyz';
const message2 = 'abcdefghijklmnoABCDEFGHIJKLMNOPQRSTUVWXYZ';
const hash1 = hardcoreIntegrity12.hash(message1, k);
const hash2 = hardcaseIntegrity12.hash(message2, k);
expect(hardcoreIntegrity12.areHashesEqual(hash1, hash2)).toBeFalsy();
});
});
