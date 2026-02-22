```Dockerfile
FROM paritytech/substrate:v3.0.0-rc1-one-command-stack-4 as base

ARG SUBSTRATE_GIT_COMMIT
ENV SUBSTRATE_GIT_COMMIT=${SUBSTRATE_GIT_COMMIT:-3.0.0-rc1}

RUN apk update && \
apk add --no-cache build-base git curl \
&& curl -sL https://raw.githubusercontent.com/paritytech/substrate/master/scripts/install_deps.sh | sh && \
git clone https://github.com/paritytech/substrate.git /substrate && \
cd substrate && \
git checkout ${SUBSTRATE_GIT_COMMIT} && \
./misc/bake-runtime --chain parachain-local --force && \
npm ci && \
Cargo_HOME=./cargo ./target/release/substrate init --chain parachain-local && \
cp substrate.rs substrate/pallets/parachain_local/src/lib.rs && \
cd substrate && \
git checkout v3.0.0-rc1 && \
npm run build --silent && \
Cargo_HOME=./cargo ./target/release/substrate node --dev --base-path /tmp/parachain-local --port 30334 --ws port 9944 --validator --unlock-account 5 --bootstrap-nodes "/ip4/127.0.0.1/tcp/30333/p2p/12D3KooWQEz73NqSjQa6c68fCzBbZTnJuQX3h1m9UQRvQ"
```

This Dockerfile extends the `paritytech/substrate:v3.0.0-rc1-one-command-stack-4` base image, customizes it by building a local parachain runtime, and finally starts the node with specific options like port, web socket port, and bootstrap nodes.
