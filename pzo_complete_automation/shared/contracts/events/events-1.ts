// @nomiclabs/bsc-sdk
import { ethers } from "ethers";
import { Contract, EventFilter, Signer } from "@ethersproject/contracts";
import { abi as TransferABI } from "../abi/Transfer.json";

export class TransferEvent extends Contract {
constructor(signerOrProvider: Signer | ethers.providers.Provider, address: string) {
super(TransferABI, address, signerOrProvider);
}

filter() {
const fromFilter = this.filters.From(null);
const toFilter = this.filters.To(null);
return this.filters.anyOf([fromFilter, toFilter]);
}
}
