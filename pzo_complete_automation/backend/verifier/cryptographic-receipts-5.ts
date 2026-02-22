import * as ethers from 'ethers';
import { keccak256 } from 'ethers/utils';
import { JsonFragment, TypedDataHash, EIP712Domain, formatEthersErrors } from '@ethersproject/abi';

export class CryptographicReceiptVerifier {
constructor(private domain: EIP712Domain) {}

async verify(signature: string, receipt: any): Promise<boolean> {
const typedDataHash = this.createTypedDataHash(receipt);
const sig = ethers.utils.arrayify(signature);
const messageHash = keccak256(typedDataHash);

try {
return await ethers.utils.verifyMessage(messageHash, sig);
} catch (error) {
console.error(`Error verifying signature: ${formatEthersErrors(error)}`);
return false;
}
}

private createTypedDataHash(receipt: any): TypedDataHash {
const domainSeparator = this.domainSeparator();
const types = [
// Replace with the actual types specific to your receipt structure
`uint256`,
`string`,
`uint8[]`,
`uint256`,
`address`,
`uint256`
];
const primaryType = `CryptographicReceipt`;
const domain = this.domain;

const values = [
// Replace with the actual receipt data you want to verify
1, // version
'example-receipt', // receiptId
JSON.stringify([1, 2, 3]).split('').map(x => BigInt(parseInt(x, 10))), // calldata
123456789, // gasUsed
ethers.utils.getAddress(ethers.constants.AddressZero), // sender
987654321 // blockNumber
];

const frags: JsonFragment[] = [
{
name: 'types',
type: `Tuple[${(types.length)}]`,
components: types
},
{
name: 'domain',
type: 'Domain',
components: [
{ name: 'name', type: 'string' },
{ name: 'version', type: 'uint256' },
{ name: 'chainId', type: 'uint256' },
{ name: 'verifyingContract', type: 'address' }
]
},
{
name: 'message',
type: `Tuple[${(domain.message.types.length)}]`,
components: domain.message.types.map((t) => t.name)
},
{
name: 'signature',
type: 'Bytes'
}
];

const typedData = {
name: primaryType,
types: frags.map((frag) => frag.type),
domain: domain,
message: {
...domain.message,
...frags[2].components.reduce(
(acc, curr, index) => ({ ...acc, [curr.name]: values[index] }),
{}
)
},
signature: ethers.utils.toUtf8Bytes(signature)
};

return typedDataHash(typedData);
}

private domainSeparator(): string {
const EIP712_DOMAIN_SEPARATOR_TYPEHASH =
'0x0d62f35b00cbb3056ae0e0efac4a98b6a3f6604867d556ed3bf313366a700545';
const domainSeparatorBytes = ethers.utils._TypedDataEncoder.hashDomain(this.domain);
return keccak256(ethers.utils.concat([EIP712_DOMAIN_SEPARATOR_TYPEHASH, domainSeparatorBytes])) as string;
}
}
