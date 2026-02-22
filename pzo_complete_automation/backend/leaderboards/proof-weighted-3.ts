async function main() {
const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545'); // replace with your Ethereum node URL
const contractABI = [...]; // replace with your contract's ABI
const contractAddress = '0x...'; // replace with your contract's address

const leaderboard = new Leaderboard(provider, contractAddress, contractABI);
const leaders = await leaderboard.getLeaderboard();

console.log(leaders);
}

main().catch((error) => {
console.error(error);
});
```
