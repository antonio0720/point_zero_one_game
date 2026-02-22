import { ethers } from "hardhat";
import { SolidityUserStructOutput, UserEvent } from "../typechain/IUserContract";
import { solidity } from "ethereum-types";

export type EventUser = UserEvent;

export interface User {
id: solidity.BigNumberish;
name: string;
email: string;
}

export type UserStructOutput = SolidityUserStructOutput;
