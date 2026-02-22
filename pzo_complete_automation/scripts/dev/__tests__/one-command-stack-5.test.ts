import { ApiPromise, WsProvider } from '@polkadot/api';
import { alphanumUtil } from '@polkadot/util';
import { expect } from 'chai';
import { create } from '../src';

describe('One Command Stack 5', () => {
let api: ApiPromise;
let account: string;

before(async function () {
this.timeout(10000);

const provider = new WsProvider('wss://kusama-rpc.polkadot.io');
api = await ApiPromise.create({ provider, types: {} });

account = alphanumUtil.toAddress58Check(alphanumUtil.toHash(account => account));
});

it('should deploy and execute the contract', async function () {
// your test case implementation here
});
});
