import { Allowlist } from '../allowlist';
import { IAllowlistItem } from '../../interfaces/IAllowlistItem';
import { expect } from 'chai';

describe('ML Data Governance - Allowlists-8', () => {
let allowlist: Allowlist;

beforeEach(() => {
allowlist = new Allowlist();
});

it('should add and remove items in the allowlist', () => {
const item1: IAllowlistItem = { id: 'item1', name: 'Test Item 1' };
const item2: IAllowlistItem = { id: 'item2', name: 'Test Item 2' };

allowlist.add(item1);
expect(allowlist.getAll().length).to.equal(1);
expect(allowlist.contains(item1)).to.be.true;

allowlist.add(item2);
expect(allowlist.getAll().length).to.equal(2);
expect(allowlist.contains(item1)).to.be.true;
expect(allowlist.contains(item2)).to.be.true;

allowlist.remove(item1);
expect(allowlist.getAll().length).to.equal(1);
expect(allowlist.contains(item1)).to.be.false;
expect(allowlist.contains(item2)).to.be.true;
});

it('should not add duplicate items in the allowlist', () => {
const item: IAllowlistItem = { id: 'duplicate', name: 'Test Duplicate' };

allowlist.add(item);
expect(allowlist.getAll().length).to.equal(1);
expect(allowlist.contains(item)).to.be.true;

allowlist.add(item);
expect(allowlist.getAll().length).to.equal(1);
expect(allowlist.contains(item)).to.be.true;
});

it('should find items by their ID in the allowlist', () => {
const item1: IAllowlistItem = { id: 'item1', name: 'Test Item 1' };
const item2: IAllowlistItem = { id: 'item2', name: 'Test Item 2' };

allowlist.add(item1);
allowlist.add(item2);

expect(allowlist.findById(item1.id)).to.deep.equal(item1);
expect(allowlist.findById(item2.id)).to.deep.equal(item2);
});

it('should not find items by their non-existing ID in the allowlist', () => {
const item: IAllowlistItem = { id: 'nonExistingId', name: 'Test Non-Existent' };

expect(allowlist.findById(item.id)).to.be.null;
});
});
