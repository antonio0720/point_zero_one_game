import { Contract, Event, log } from "@openzeppelin/upgrades";
import { IERC721Metadata } from '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata';
import { ERC721 } from '@openzeppelin/contracts/token/ERC721';

export class IDs5 extends Contract {
constructor(address: string) {
super(address, [
'event IDCreated(uint256 indexed _id, address _owner, string memory _name, uint8 _tokenId, string memory _description);',
]);
}

async onERC721MetadataUpdated(
owner: string,
tokenId_: BigNumber,
uri: string,
name_,
symbol_: string
) {
const tokenId = tokenId_.toNumber();
if (tokenId === 5) {
await this.emit('IDCreated', tokenId, owner, name_, tokenId, 'Description for ID #5');
}
}
}
