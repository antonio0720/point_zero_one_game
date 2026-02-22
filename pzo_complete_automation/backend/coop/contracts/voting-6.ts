import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { VotingContract as VotingContractBase } from '../base/VotingContract';

export class VotingContract6 extends VotingContractBase {
// Override or add any functions specific to version 6 here.

constructor(initData: Bytes) {
super(initData);
}
}
