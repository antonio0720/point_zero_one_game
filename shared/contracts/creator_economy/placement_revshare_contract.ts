/**
 * Placement Revenue Share Contract
 */

declare module 'hardhat' {
  interface ContractDeploymentOptions {
    from?: string;
  }
}

import { Contract, ContractFactory, BigNumber, Signer } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/dist/types';
import '@nomiclabs/hardhat-waffle';

/**
 * Placement Revenue Share Contract Factory
 */
export class PlacementRevshareContractFactory extends ContractFactory {
  constructor(hre: HardhatRuntimeEnvironment, account?: Signer) {
    super(hre, account);
  }

  public async deploy(options?: ContractDeploymentOptions): Promise<Contract> {
    const contract = await this.deploy(_PlacementRevshareContract, [], options);
    return contract;
  }
}

/**
 * Placement Revenue Share Contract Interface
 */
export interface IPlacementRevshareContract {
  placementPool(): Promise<BigNumber>;
  rankingSignals(index: BigNumber): Promise<BigNumber>;
  revshareLedger(index: BigNumber): Promise<BigNumber>;
  payoutPeriods(): Promise<BigNumber[]>;
  clawbackStates(index: BigNumber): Promise<boolean>;
}

/**
 * Placement Revenue Share Contract Implementation
 */
export class _PlacementRevshareContract extends Contract implements IPlacementRevshareContract {}

/**
 * Deploy Placement Revenue Share Contract
 */
const deployPlacementRevshareContract: DeployFunction = async (hre) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const placementRevshareContractFactory = new PlacementRevshareContractFactory(hre, deployer);
  const placementRevshareContract = await placementRevshareContractFactory.deploy({ from: deployer });

  await deployments.log('Deployed Placement Revenue Share Contract', { deployedContract: placementRevshareContract.address });
};

export default deployPlacementRevshareContract;
