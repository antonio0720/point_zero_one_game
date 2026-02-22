// src/lib/chainSpec.ts
import { Aura, Babe, Grandpa, Ss58Format, AuthorityDiscovery, AuthorshipWasmerRuntime, WasmLocalStorageBackend } from '@polkadot/api';
import { parseChainSpec, genesisState as substrateGenesisState } from '@polkadot/genesis-config';

const chainSpec = {
name: 'local-services-2',
network: 'dev',
nodeName: 'Local Services Node',
genesisHash: substrateGenesisState('dev').hash,
genesisHashing: { algo: 'blake2b', parameters: {} },
slotsPerBlock: 12,
slotDuration: 6,
authoringStartSlot: 0,
defaultSSz: 1024 * 32,
alphaSSz: 1024,
maxMetadataRetry: Infinity,
bootnodes: [],
ss58Format: Ss58Format.sr-opt-2,
types: {},
authoringDataDeposit: 0,
disableUnsafe: false,
};

const localChainSpec = parseChainSpec(chainSpec);

export const { provider, api } = new Aura({
type: 'development',
chainSpec: localChainSpec,
telemetry: { enabled: false },
});

// src/lib/api.ts
import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { chainSpec } from './chainSpec';

export const api = new ApiPromise({ provider: new WsProvider('ws://localhost:9944') });
api.isReady.then(() => {
console.log('Polkadot API ready');
});

// src/lib/keyring.ts
import { Keyring } from '@polkadot/api';
import { mnemonicGenerate } from '@polkadot/util-crypto';

export const keyring = new Keyring({ type: 'sr25519' });
const mnemonic = mnemonicGenerate(24);
const account = keyring.addFromMnemonic(mnemonic, 'hrp-opt-2');
console.log(`Account Address: ${account.address}`);
console.log(`Account Public Key: ${account.ss58Format.sr-opt-2.toString()}`);
