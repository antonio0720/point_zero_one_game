import * as dotenv from 'dotenv';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

// Load environment variables
dotenv.config();

const provider = new WsProvider(process.env.WS_PROVIDER);
const api = await ApiPromise.create({ provider });

const keyring = new Keyring({ type: 'sr25519' });
const account = keyring.addFromMnemonic(process.env.MNEMONIC);

// Your custom service implementation here...
