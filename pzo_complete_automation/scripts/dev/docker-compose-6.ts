import * as komposer from 'docker-kompose';

const projectName = 'local-dev-substrate';
const dockerComposeFile = `
version: '3'
services:
substrate:
image: substrate/substrate:latest
environment:
RUST_LOG=debug
SUBSTRATE_TLS_PORT: 9944
WS_BACKENDS: "ws://localhost:9945"
MIN_PEERS: 1
PEER_SEEDS: "/dns4/dockerd.local/tcp/4001/ipfs/QmTpKJxwAe36C8Z7tAwXfEhbF11gVYXMvzg1YG6UdPjrS"
ports:
- "9933:9933"
- "9944:9944"
- "9945:9945"
volumes:
- ./local-dev-substrate:/etc/substrate

polkadot-js:
image: paritytech/polkadot-extension:latest
depends_on:
- substrate
command: >
bash -c "
set -ex
apm install --no-save web-ext-polyfill
apm link web-ext-polyfill
yarn build
yarn pack
"
volumes:
- ./local-dev-substrate/extension:/usr/src/app

firefox:
image: mozilla/firefox:latest
depends_on:
- polkadot-js
command: >
bash -c "
set -ex
mkdir -p /tmp/extensions
mv /usr/src/app/dist/*.xpi /tmp/extensions/
firefox --no-remote -P Profile1 --profile Manager -a about:debugging#/runtime/this-firefox -c '{\"id\": \"2\",\"url\": \"chrome://extensions/?id=addon_id\",\"args\": [],\"file\": \"about:debugging#/runtime/this-firefox\"}'
"
environment:
FIREFOX_PROFILE: Profile1
volumes:
- ./local-dev-substrate/extensions:/tmp/extensions
`;

komposer.config({ verbose: true }).load(dockerComposeFile).up();
