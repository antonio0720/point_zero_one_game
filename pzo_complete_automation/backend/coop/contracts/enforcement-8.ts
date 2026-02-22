import { BigNumber, ethers } from 'ethers';
import { Contract, Signer } from 'ethers';
import { CoopToken, ICoopAuctionHouse, ICoopToken, ERC20 } from '../interfaces';
import { parseEther } from 'ethers/lib/utils';

export class EnforcementContract8 implements Contract {
private _provider: ethers.providers.Provider;
private _signer: Signer;
private _address: string;
private coopToken: CoopToken;
private auctionHouse: ICoopAuctionHouse;

constructor(
providerOrSigner: ethers.providers.Provider | Signer,
address: string,
coopTokenAddress: string,
auctionHouseAddress: string
) {
this._provider = providerOrSigner instanceof ethers.providers.Provider ? providerOrSigner : new ethers.providers.JsonRpcProvider(providerOrSigner as any);
this._signer = providerOrSigner instanceof Signer ? providerOrSigner : new ethers.Wallet(process.env.PRIVATE_KEY as string, this._provider);
this._address = address;

const coopTokenABI: any[] = [
// CoopToken ABI here
];
const auctionHouseABI: any[] = [
// ICoopAuctionHouse ABI here
];

this.coopToken = new ethers.Contract(coopTokenAddress, coopTokenABI, this._signer) as CoopToken;
this.auctionHouse = new ethers.Contract(auctionHouseAddress, auctionHouseABI, this._signer) as ICoopAuctionHouse;
}

public async enforceLateFee(): Promise<void> {
const coopBalanceBefore = await this.coopToken.balanceOf(this._address);
const lateFeeAmount = parseEther('0.01'); // 1% of the total co-op balance as a late fee
const coopTotalSupply = await this.coopToken.totalSupply();

if (coopBalanceBefore.lt(coopTotalSupply)) {
const missingCoopAmount = coopTotalSupply.sub(coopBalanceBefore);
await this.coopToken.transfer(this._address, missingCoopAmount);
}

const userBidBefore = await this.auctionHouse.getUserCurrentBid(this._signer.address);
const lateFeeInCurrency = userBidBefore.mul(lateFeeAmount).div(parseEther('1')); // Calculate late fee in currency based on the current bid amount

await this.coopToken.transfer(this.auctionHouse.address, lateFeeInCurrency);
}
}
