import rawBRE from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import {
  insertContractAddressInDb,
  getEthersSigners,
  registerContractInJsonDb,
  getEthersSignersAddresses,
} from '../../helpers/contracts-helpers';
import {
  deployLendingPoolAddressesProvider,
  deployMintableERC20,
  deployLendingPoolAddressesProviderRegistry,
  deployLendingPoolConfigurator,
  deployLendingPool,
  deployPriceOracle,
  deployLendingPoolCollateralManager,
  deployMockFlashLoanReceiver,
  deployWalletBalancerProvider,
  deployPegasysProtocolDataProvider,
  deployLendingRateOracle,
  deployStableAndVariableTokensHelper,
  deployATokensAndRatesHelper,
  deployWSYSGateway,
  deployWSYSMocked,
  deployMockUniswapRouter,
  deployUniswapLiquiditySwapAdapter,
  deployUniswapRepayAdapter,
  deployFlashLiquidationAdapter,
  deployMockParaSwapAugustus,
  deployMockParaSwapAugustusRegistry,
  deployParaSwapLiquiditySwapAdapter,
  authorizeWSYSGateway,
  deployATokenImplementations,
  deployPegasysOracle,
} from '../../helpers/contracts-deployments';
import { Signer } from 'ethers';
import { TokenContractId, eContractid, tEthereumAddress, PegasysPools } from '../../helpers/types';
import { MintableERC20 } from '../../typechain/MintableERC20';
import {
  ConfigNames,
  getReservesConfigByPool,
  getTreasuryAddress,
  loadPoolConfig,
} from '../../helpers/configuration';
import { initializeMakeSuite } from './helpers/make-suite';

import {
  setInitialAssetPricesInOracle,
  deployAllMockAggregators,
  setInitialMarketRatesInRatesOracleByHelper,
} from '../../helpers/oracles-helpers';
import { DRE, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import PegasysConfig from '../../markets/pegasys';
import { oneEther, ZERO_ADDRESS } from '../../helpers/constants';
import {
  getLendingPool,
  getLendingPoolConfiguratorProxy,
  getPairsTokenAggregator,
} from '../../helpers/contracts-getters';
import { WSYSMocked } from '../../typechain/WSYSMocked';

const MOCK_USD_PRICE_IN_WEI = PegasysConfig.ProtocolGlobalParams.MockUsdPriceInWei;
const ALL_ASSETS_INITIAL_PRICES = PegasysConfig.Mocks.AllAssetsInitialPrices;
const USD_ADDRESS = PegasysConfig.ProtocolGlobalParams.UsdAddress;
const LENDING_RATE_ORACLE_RATES_COMMON = PegasysConfig.LendingRateOracleRatesCommon;

// const deployAllMockTokens = async (deployer: Signer) => {
//   const tokens: { [symbol: string]: MockContract | MintableERC20 | WSYSMocked } = {};

//   const protoConfigData = getReservesConfigByPool(PegasysPools.proto);

//   for (const tokenSymbol of Object.keys(TokenContractId)) {
//     if (tokenSymbol === 'WSYS') {
//       tokens[tokenSymbol] = await deployWSYSMocked();
//       await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
//       continue;
//     }
//     let decimals = 18;

//     let configData = (<any>protoConfigData)[tokenSymbol];

//     if (!configData) {
//       decimals = 18;
//     }

//     tokens[tokenSymbol] = await deployMintableERC20([
//       tokenSymbol,
//       tokenSymbol,
//       configData ? configData.reserveDecimals : 18,
//     ]);
//     await registerContractInJsonDb(tokenSymbol.toUpperCase(), tokens[tokenSymbol]);
//   }

//   return tokens;
// };

// const buildTestEnv = async (deployer: Signer, secondaryWallet: Signer) => {
//   console.time('setup');
//   const pegasysAdmin = await deployer.getAddress();
//   const config = loadPoolConfig(ConfigNames.Pegasys);

//   const mockTokens: {
//     [symbol: string]: MockContract | MintableERC20 | WSYSMocked;
//   } = {
//     ...(await deployAllMockTokens(deployer)),
//   };
//   const addressesProvider = await deployLendingPoolAddressesProvider(PegasysConfig.MarketId);
//   await waitForTx(await addressesProvider.setPoolAdmin(pegasysAdmin));

//   //setting users[1] as emergency admin, which is in position 2 in the DRE addresses list
//   const addressList = await getEthersSignersAddresses();

//   await waitForTx(await addressesProvider.setEmergencyAdmin(addressList[2]));

//   const addressesProviderRegistry = await deployLendingPoolAddressesProviderRegistry();
//   await waitForTx(
//     await addressesProviderRegistry.registerAddressesProvider(addressesProvider.address, 1)
//   );

//   const lendingPoolImpl = await deployLendingPool();

//   await waitForTx(await addressesProvider.setLendingPoolImpl(lendingPoolImpl.address));

//   const lendingPoolAddress = await addressesProvider.getLendingPool();
//   const lendingPoolProxy = await getLendingPool(lendingPoolAddress);

//   await insertContractAddressInDb(eContractid.LendingPool, lendingPoolProxy.address);

//   const lendingPoolConfiguratorImpl = await deployLendingPoolConfigurator();
//   await waitForTx(
//     await addressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfiguratorImpl.address)
//   );

//   const lendingPoolConfiguratorProxy = await getLendingPoolConfiguratorProxy(
//     await addressesProvider.getLendingPoolConfigurator()
//   );
//   await insertContractAddressInDb(
//     eContractid.LendingPoolConfigurator,
//     lendingPoolConfiguratorProxy.address
//   );

//   // Deploy deployment helpers
//   await deployStableAndVariableTokensHelper([lendingPoolProxy.address, addressesProvider.address]);
//   await deployATokensAndRatesHelper([
//     lendingPoolProxy.address,
//     addressesProvider.address,
//     lendingPoolConfiguratorProxy.address,
//   ]);

//   const fallbackOracle = await deployPriceOracle();
//   await waitForTx(await fallbackOracle.setEthUsdPrice(MOCK_USD_PRICE_IN_WEI));
//   await setInitialAssetPricesInOracle(
//     ALL_ASSETS_INITIAL_PRICES,
//     {
//       WSYS: mockTokens.WSYS.address,
//       DAI: mockTokens.DAI.address,
//       TUSD: mockTokens.TUSD.address,
//       USDC: mockTokens.USDC.address,
//       USDT: mockTokens.USDT.address,
//       SUSD: mockTokens.SUSD.address,
//       AAVE: mockTokens.AAVE.address,
//       BAT: mockTokens.BAT.address,
//       MKR: mockTokens.MKR.address,
//       LINK: mockTokens.LINK.address,
//       KNC: mockTokens.KNC.address,
//       BTC: mockTokens.BTC.address,
//       MANA: mockTokens.MANA.address,
//       ZRX: mockTokens.ZRX.address,
//       SNX: mockTokens.SNX.address,
//       BUSD: mockTokens.BUSD.address,
//       YFI: mockTokens.BUSD.address,
//       REN: mockTokens.REN.address,
//       UNI: mockTokens.UNI.address,
//       ENJ: mockTokens.ENJ.address,
//       // DAI: mockTokens.LpDAI.address,
//       // USDC: mockTokens.LpUSDC.address,
//       // USDT: mockTokens.LpUSDT.address,
//       // BTC: mockTokens.LpBTC.address,
//       // WSYS: mockTokens.LpWSYS.address,
//       UniDAIWSYS: mockTokens.UniDAIWSYS.address,
//       UniBTCWSYS: mockTokens.UniBTCWSYS.address,
//       UniAAVEWSYS: mockTokens.UniAAVEWSYS.address,
//       UniBATWSYS: mockTokens.UniBATWSYS.address,
//       UniDAIUSDC: mockTokens.UniDAIUSDC.address,
//       UniCRVWSYS: mockTokens.UniCRVWSYS.address,
//       UniLINKWSYS: mockTokens.UniLINKWSYS.address,
//       UniMKRWSYS: mockTokens.UniMKRWSYS.address,
//       UniRENWSYS: mockTokens.UniRENWSYS.address,
//       UniSNXWSYS: mockTokens.UniSNXWSYS.address,
//       UniUNIWSYS: mockTokens.UniUNIWSYS.address,
//       UniUSDCWSYS: mockTokens.UniUSDCWSYS.address,
//       UniBTCUSDC: mockTokens.UniBTCUSDC.address,
//       UniYFIWSYS: mockTokens.UniYFIWSYS.address,
//       BptBTCWSYS: mockTokens.BptBTCWSYS.address,
//       BptBALWSYS: mockTokens.BptBALWSYS.address,
//       WMATIC: mockTokens.WMATIC.address,
//       USD: USD_ADDRESS,
//       STAKE: mockTokens.STAKE.address,
//       xSUSHI: mockTokens.xSUSHI.address,
//       WAVAX: mockTokens.WAVAX.address,
//     },
//     fallbackOracle
//   );

//   const mockAggregators = await deployAllMockAggregators(ALL_ASSETS_INITIAL_PRICES);
//   const allTokenAddresses = Object.entries(mockTokens).reduce(
//     (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, tokenContract]) => ({
//       ...accum,
//       [tokenSymbol]: tokenContract.address,
//     }),
//     {}
//   );
//   const allAggregatorsAddresses = Object.entries(mockAggregators).reduce(
//     (accum: { [tokenSymbol: string]: tEthereumAddress }, [tokenSymbol, aggregator]) => ({
//       ...accum,
//       [tokenSymbol]: aggregator,
//     }),
//     {}
//   );

//   const [tokens, aggregators] = getPairsTokenAggregator(
//     allTokenAddresses,
//     allAggregatorsAddresses,
//     config.OracleQuoteCurrency
//   );

//   await deployPegasysOracle([
//     tokens,
//     aggregators,
//     fallbackOracle.address,
//     mockTokens.WSYS.address,
//     oneEther.toString(),
//   ]);
//   await waitForTx(await addressesProvider.setPriceOracle(fallbackOracle.address));

//   const lendingRateOracle = await deployLendingRateOracle();
//   await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));

//   const { USD, ...tokensAddressesWithoutUsd } = allTokenAddresses;
//   const allReservesAddresses = {
//     ...tokensAddressesWithoutUsd,
//   };
//   await setInitialMarketRatesInRatesOracleByHelper(
//     LENDING_RATE_ORACLE_RATES_COMMON,
//     allReservesAddresses,
//     lendingRateOracle,
//     pegasysAdmin
//   );

//   // Reserve params from AAVE pool + mocked tokens
//   const reservesParams = {
//     ...config.ReservesConfig,
//   };

//   const testHelpers = await deployPegasysProtocolDataProvider(addressesProvider.address);

//   await deployATokenImplementations(ConfigNames.Pegasys, reservesParams, false);

//   const admin = await deployer.getAddress();

//   const { ATokenNamePrefix, StableDebtTokenNamePrefix, VariableDebtTokenNamePrefix, SymbolPrefix } =
//     config;
//   const treasuryAddress = await getTreasuryAddress(config);

//   await initReservesByHelper(
//     reservesParams,
//     allReservesAddresses,
//     ATokenNamePrefix,
//     StableDebtTokenNamePrefix,
//     VariableDebtTokenNamePrefix,
//     SymbolPrefix,
//     admin,
//     treasuryAddress,
//     ZERO_ADDRESS,
//     ConfigNames.Pegasys,
//     false
//   );

//   await configureReservesByHelper(reservesParams, allReservesAddresses, testHelpers, admin);

//   const collateralManager = await deployLendingPoolCollateralManager();
//   await waitForTx(
//     await addressesProvider.setLendingPoolCollateralManager(collateralManager.address)
//   );
//   await deployMockFlashLoanReceiver(addressesProvider.address);

//   const mockUniswapRouter = await deployMockUniswapRouter();

//   const adapterParams: [string, string, string] = [
//     addressesProvider.address,
//     mockUniswapRouter.address,
//     mockTokens.WSYS.address,
//   ];

//   await deployUniswapLiquiditySwapAdapter(adapterParams);
//   await deployUniswapRepayAdapter(adapterParams);
//   await deployFlashLiquidationAdapter(adapterParams);

//   const augustus = await deployMockParaSwapAugustus();

//   const augustusRegistry = await deployMockParaSwapAugustusRegistry([augustus.address]);

//   await deployParaSwapLiquiditySwapAdapter([addressesProvider.address, augustusRegistry.address]);

//   await deployWalletBalancerProvider();

//   const gateWay = await deployWSYSGateway([mockTokens.WSYS.address]);
//   await authorizeWSYSGateway(gateWay.address, lendingPoolAddress);

//   console.timeEnd('setup');
// };

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, secondaryWallet] = await getEthersSigners();
  const FORK = true;

  if (FORK) {
    await rawBRE.run('pegasys:mainnet', { skipRegistry: true });
  } else {
    console.log('-> Deploying test environment...');
    // await buildTestEnv(deployer, secondaryWallet);
  }
  console.log('here');
  await initializeMakeSuite();
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
