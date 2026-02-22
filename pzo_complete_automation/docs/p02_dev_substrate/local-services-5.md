Local Services v5 for Substrate Development
===========================================

Welcome to the Local Services v5 documentation for Substrate development! This guide is designed to help you understand and utilize the latest version of the local services, a powerful toolset that simplifies the development process on a local blockchain network.

**Table of Contents**

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Using Local Services](#using-local-services)
- [Starting the Node](#starting-the-node)
- [Running a Test Network](#running-a-test-network)
- [Accessing and Managing Your Local Blockchain](#accessing-and-managing-your-local-blockchain)
5. [Advanced Usage](#advanced-usage)
6. [Troubleshooting](#troubleshooting)
7. [Contributing and Support](#contributing-and-support)
8. [License](#license)

<a name="introduction"></a>
## 1. Introduction

Local Services v5 is a suite of tools that simplifies the process of setting up, configuring, and managing local blockchain networks for Substrate development. It provides an easy-to-use CLI interface for launching and managing test networks, making it a valuable asset for developers working on Substrate projects.

<a name="installation"></a>
## 2. Installation

To install Local Services v5, follow the instructions provided in the [official installation guide](https://substrate.dev/docs/en/knowledgebase/getting-started/local-services).

<a name="configuration"></a>
## 3. Configuration

Before using Local Services v5, you'll need to configure your project by creating a `local.toml` file in the root directory of your Substrate project. This configuration file specifies the settings for your local blockchain network, such as the runtime, chain spec, and parachain information (if applicable).

<a name="using-local-services"></a>
## 4. Using Local Services

### <a name="starting-the-node"></a>Starting the Node

To start a local Substrate node using Local Services v5, run the following command in your project directory:

```bash
local services start
```

Local Services will automatically detect your project's configuration and launch the appropriate nodes.

### <a name="running-a-test-network"></a>Running a Test Network

To run a test network with multiple nodes, use the following command:

```bash
local services start test-network
```

Replace `test-network` with the desired name for your test network. Local Services will create and configure the necessary nodes for you.

### <a name="accessing-and-managing-your-local-blockchain"></a>Accessing and Managing Your Local Blockchain

Once your node(s) are running, you can interact with your local blockchain using various Substrate tools such as `substrate-cli`, `polkadot-js`, or other frontends.

<a name="advanced-usage"></a>
## 5. Advanced Usage

Local Services v5 offers a variety of advanced features, including support for custom runtime benchmarks, network simulations, and more. For detailed information about these features, consult the [official documentation](https://substrate.dev/docs/en/knowledgebase/local-services).

<a name="troubleshooting"></a>
## 6. Troubleshooting

If you encounter any issues while using Local Services v5, please refer to the [official troubleshooting guide](https://substrate.dev/docs/en/knowledgebase/local-services#troubleshooting). If your problem remains unresolved, feel free to reach out to the Substrate community for support.

<a name="contributing-and-support"></a>
## 7. Contributing and Support

Contributions to Local Services v5 are welcome! To learn more about contributing, visit the [Substrate contributors guide](https://substrate.dev/docs/en/knowledgebase/contribute). For support, join the Substrate community on Discord, Gitter, or StackExchange.

<a name="license"></a>
## 8. License

Local Services v5 is open-source software licensed under the [MIT license](https://opensource.org/licenses/MIT). For more information, consult the `LICENSE` file in the Local Services repository.
