import { Balance } from './Balance';
import { Faker } from '@faker-js/faker';
import { expect } from 'chai';
import 'mocha';
import { describe, it } from 'mocha';

describe('Balance', () => {
let balance: Balance;
const faker = new Faker();

beforeEach(() => {
balance = new Balance(faker.datatype.number({ min: 0, max: 1000 }));
});

it('should deposit money and update the balance', () => {
const amountToDeposit = faker.datatype.number({ min: 1, max: 100 });
balance.deposit(amountToDeposit);
expect(balance.getBalance()).to.be.equal(balance.initialBalance + amountToDeposit);
});

it('should withdraw money and update the balance', () => {
const initialBalance = balance.getBalance();
const amountToWithdraw = Math.min(faker.datatype.number({ min: 1, max: initialBalance }), initialBalance / 2);
balance.withdraw(amountToWithdraw);
expect(balance.getBalance()).to.be.equal(initialBalance - amountToWithdraw);
});

it('should throw an error when trying to withdraw more money than available', () => {
const initialBalance = balance.getBalance();
const amountToWithdraw = initialBalance + 1;
expect(() => balance.withdraw(amountToWithdraw)).to.throw(/Insufficient funds/);
});
});
