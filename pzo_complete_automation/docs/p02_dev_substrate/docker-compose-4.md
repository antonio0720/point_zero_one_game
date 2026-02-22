Substrate Local Development with Docker Compose (v4)
=============================================

This guide will walk you through setting up a local development environment for Substrate using Docker Compose version 4.

Prerequisites
-------------

1. Install [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) on your system.
2. Clone the Substrate repository: `git clone https://github.com/paritytech/substrate`
3. Navigate to the substrate directory: `cd substrate`
4. Create a new node directory: `mkdir my_node && cd my_node`

Setup Docker Compose
--------------------

1. Create a `docker-compose.yml` file in your `my_node` directory with the following content:

```yaml
version: '4'
services:
substrate:
image: paritytech/substrate:latest
container_name: my_node
environment:
RUST_LOG: substrate=trace,chain=debug
SUBSTRATE_GENESIS_JSON: ./genesis.json
volumes:
- ./keyring:/root/.local/share/substrate/keyring
- ./chainspec:/etc/substrate
ports:
- 9944:9944/tcp # WS RPC
- 30333:30333/tcp # JSON-RPC
- 9993:9993/tcp # Telemetry

networks:
default:
external:
name: substrate_network
```

2. Replace `./genesis.json` with the path to your custom chain specification or create a new one using the [Substrate Node Template](https://github.com/paritytech/substrate-node-template).
3. Create directories for keyring and chainspec: `mkdir -p ./keyring ./chainspec`
4. Start your local development environment by running: `docker-compose up --build`

Accessing the Substrate Node
----------------------------

1. Access the JSON RPC endpoint at `http://localhost:30333`.
2. Access the WS RPC endpoint at `ws://localhost:9944`.
3. You can find your node's keyring at `~/.local/share/substrate/keyring` within the host system.
4. To check the logs, run: `docker-compose logs -f my_node`

Stopping and Removing the Environment
-------------------------------------

1. Stop your local development environment by running: `docker-compose down`
2. Remove all stopped containers, networks, images, and volumes with: `docker-compose down --volumes --rmi all`
