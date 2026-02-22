One-Command Substrate Stack 2 (OCSS-2)
=======================================

Overview
--------

One-Command Substrate Stack 2 (OCSS-2) is a streamlined setup for running a local development environment using the Substrate framework by Parity Technologies. This guide will walk you through installing all necessary dependencies and configuring your project with OCSS-2, enabling you to bootstrap and deploy your own Substrate blockchain in just one command.

Prerequisites
-------------

Before getting started, make sure you have the following prerequisites installed:

1. Node.js (v14 or later) - https://nodejs.org/en/download/
2. Rust (nightly build) - https://www.rust-lang.org/tools/install
3. Substrate CLI (v3.0.0-dev or later) - https://docs.substrate.io/tutorials/getting-started/local-development/
4. WASM Toolchain (v1.52.0 or later) - https://github.com/webassembly/wasm-pack#installation

Installation
------------

To install the OCSS-2 setup, run the following command in your terminal:

```sh
curl -sSL https://raw.githubusercontent.com/substrate-developer-hub/one-command-stack/master/scripts/install_oscc2.sh | sh
```

This will install the required dependencies and add necessary aliases to your shell configuration.

Project Setup
-------------

To create a new project using OCSS-2, navigate to the directory where you want to store your projects, and run:

```sh
substrate new my_project --oscc2
```

Replace `my_project` with the name of your new project. This command will create a fresh Substrate project using OCSS-2 templates and dependencies.

Bootstrap & Deploy
------------------

To bootstrap and deploy your blockchain, navigate to your newly created project directory, and run:

```sh
substrate build && substrate node --dev
```

Your local development blockchain will be built and deployed using the one-command setup. You can view its status by running:

```sh
substrate dapp
```

This command will open a new terminal window displaying various useful information about your running substrate node, including logs, stats, and an interface for interacting with the network.

Conclusion
----------

With OCSS-2, setting up and deploying a local Substrate development environment is now easier than ever. Happy building!
