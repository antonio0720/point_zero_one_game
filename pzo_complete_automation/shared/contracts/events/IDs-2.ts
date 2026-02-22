import { Contract } from 'ethers';
import { IERC165, ERC721, ERC721Enumerable, Ownable } from '@openzeppelin/contracts-all';

export interface IDSEvent extends ERC721.Event {
owner: string;
indexedTokenId: BigNumberish;
}

declare abstract class IDSContract extends Contract implements IERC721, ERC721Enumerable, Ownable {
constructor(address: string) {
super(address);
}

async on(eventName: 'Transfer', filter?: any): Promise<IDSEvent[]> {
const rawLogs = await this.queryFilter(eventName, filter);
return rawLogs.map((log) => ({
event: 'Transfer',
args: {
_owner: log.args._owner,
_tokenId: log.args._tokenId,
},
log: log,
}));
}
}
