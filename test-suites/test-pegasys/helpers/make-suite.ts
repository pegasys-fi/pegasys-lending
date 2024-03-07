import { evmRevert, evmSnapshot, DRE } from '../../../helpers/misc-utils';
import { Signer } from 'ethers';
import {
  getLendingPool,
  getLendingPoolAddressesProvider,
  getPegasysProtocolDataProvider,
  getAToken,
  getMintableERC20,
  getLendingPoolConfiguratorProxy,
  getPriceOracle,
  getLendingPoolAddressesProviderRegistry,
  getWSYSMocked,
  getWSYSGateway,
  getUniswapLiquiditySwapAdapter,
  getUniswapRepayAdapter,
  getFlashLiquidationAdapter,
  getParaSwapLiquiditySwapAdapter,
} from '../../../helpers/contracts-getters';
import { eEthereumNetwork, eNetwork, tEthereumAddress } from '../../../helpers/types';
import { LendingPool } from '../../../typechain/LendingPool';
import { PegasysProtocolDataProvider } from '../../../typechain/PegasysProtocolDataProvider';
import { MintableERC20 } from '../../../typechain/MintableERC20';
import { AToken } from '../../../typechain/AToken';
import { LendingPoolConfigurator } from '../../../typechain/LendingPoolConfigurator';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { almostEqual } from './almost-equal';
import { PriceOracle } from '../../../typechain/PriceOracle';
import { LendingPoolAddressesProvider } from '../../../typechain/LendingPoolAddressesProvider';
import { LendingPoolAddressesProviderRegistry } from '../../../typechain/LendingPoolAddressesProviderRegistry';
import { getEthersSigners } from '../../../helpers/contracts-helpers';
import { UniswapLiquiditySwapAdapter } from '../../../typechain/UniswapLiquiditySwapAdapter';
import { UniswapRepayAdapter } from '../../../typechain/UniswapRepayAdapter';
import { ParaSwapLiquiditySwapAdapter } from '../../../typechain/ParaSwapLiquiditySwapAdapter';
import { getParamPerNetwork } from '../../../helpers/contracts-helpers';
import { WSYSMocked } from '../../../typechain/WSYSMocked';
import { WSYSGateway } from '../../../typechain/WSYSGateway';
import { solidity } from 'ethereum-waffle';
import { PegasysConfig } from '../../../markets/pegasys';
import { FlashLiquidationAdapter } from '../../../typechain';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

chai.use(bignumberChai());
chai.use(almostEqual());
chai.use(solidity);

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  pool: LendingPool;
  configurator: LendingPoolConfigurator;
  oracle: PriceOracle;
  helpersContract: PegasysProtocolDataProvider;
  wsys: WSYSMocked;
  aWSYS: AToken;
  dai: MintableERC20;
  aDai: AToken;
  usdc: MintableERC20;
  pegasys: MintableERC20;
  addressesProvider: LendingPoolAddressesProvider;
  uniswapLiquiditySwapAdapter: UniswapLiquiditySwapAdapter;
  uniswapRepayAdapter: UniswapRepayAdapter;
  registry: LendingPoolAddressesProviderRegistry;
  wsysGateway: WSYSGateway;
  flashLiquidationAdapter: FlashLiquidationAdapter;
  paraswapLiquiditySwapAdapter: ParaSwapLiquiditySwapAdapter;
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
  buidlerevmSnapshotId = id;
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as LendingPool,
  configurator: {} as LendingPoolConfigurator,
  helpersContract: {} as PegasysProtocolDataProvider,
  oracle: {} as PriceOracle,
  wsys: {} as WSYSMocked,
  aWSYS: {} as AToken,
  dai: {} as MintableERC20,
  aDai: {} as AToken,
  usdc: {} as MintableERC20,
  pegasys: {} as MintableERC20,
  addressesProvider: {} as LendingPoolAddressesProvider,
  uniswapLiquiditySwapAdapter: {} as UniswapLiquiditySwapAdapter,
  uniswapRepayAdapter: {} as UniswapRepayAdapter,
  flashLiquidationAdapter: {} as FlashLiquidationAdapter,
  paraswapLiquiditySwapAdapter: {} as ParaSwapLiquiditySwapAdapter,
  registry: {} as LendingPoolAddressesProviderRegistry,
  wsysGateway: {} as WSYSGateway,
} as TestEnv;

export async function initializeMakeSuite() {
  const [_deployer, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.pool = await getLendingPool();

  testEnv.configurator = await getLendingPoolConfiguratorProxy();

  testEnv.addressesProvider = await getLendingPoolAddressesProvider();

  if (process.env.FORK) {
    testEnv.registry = await getLendingPoolAddressesProviderRegistry(
      getParamPerNetwork(PegasysConfig.ProviderRegistry, process.env.FORK as eNetwork)
    );
  } else {
    testEnv.registry = await getLendingPoolAddressesProviderRegistry();
    testEnv.oracle = await getPriceOracle();
  }

  testEnv.helpersContract = await getPegasysProtocolDataProvider();

  const allTokens = await testEnv.helpersContract.getAllATokens();
  const aDaiAddress = allTokens.find((aToken) => aToken.symbol === 'aDAI')?.tokenAddress;

  const aWEthAddress = allTokens.find((aToken) => aToken.symbol === 'aWSYS')?.tokenAddress;

  const reservesTokens = await testEnv.helpersContract.getAllReservesTokens();

  const daiAddress = reservesTokens.find((token) => token.symbol === 'DAI')?.tokenAddress;
  const usdcAddress = reservesTokens.find((token) => token.symbol === 'USDC')?.tokenAddress;
  const pegasysAddress = reservesTokens.find((token) => token.symbol === 'AAVE')?.tokenAddress;
  const wsysAddress = reservesTokens.find((token) => token.symbol === 'WSYS')?.tokenAddress;

  if (!aDaiAddress || !aWEthAddress) {
    process.exit(1);
  }
  if (!daiAddress || !usdcAddress || !pegasysAddress || !wsysAddress) {
    process.exit(1);
  }

  testEnv.aDai = await getAToken(aDaiAddress);
  testEnv.aWSYS = await getAToken(aWEthAddress);

  testEnv.dai = await getMintableERC20(daiAddress);
  testEnv.usdc = await getMintableERC20(usdcAddress);
  testEnv.pegasys = await getMintableERC20(pegasysAddress);
  testEnv.wsys = await getWSYSMocked(wsysAddress);
  testEnv.wsysGateway = await getWSYSGateway();

  testEnv.uniswapLiquiditySwapAdapter = await getUniswapLiquiditySwapAdapter();
  testEnv.uniswapRepayAdapter = await getUniswapRepayAdapter();
  testEnv.flashLiquidationAdapter = await getFlashLiquidationAdapter();

  testEnv.paraswapLiquiditySwapAdapter = await getParaSwapLiquiditySwapAdapter();
}

const setSnapshot = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;
  setBuidlerevmSnapshotId(await evmSnapshot());
};

const revertHead = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;

  await evmRevert(buidlerevmSnapshotId);
};

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      await setSnapshot();
    });
    tests(testEnv);
    after(async () => {
      await revertHead();
    });
  });
}
