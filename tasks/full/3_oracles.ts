import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployAaveOracle, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eEthereumNetwork, SymbolMap } from '../../helpers/types';
import { waitForTx, notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWethAddress,
  getGenesisPoolAdmin,
  getLendingRateOracles,
} from '../../helpers/configuration';
import {
  getAaveOracle,
  getLendingPoolAddressesProvider,
  getLendingRateOracle,
  getPairTokenIndexes,
} from '../../helpers/contracts-getters';

task('full:deploy-oracles', 'Deploy oracles for dev enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, DRE) => {
    try {
      await DRE.run('set-DRE');
      const network = <eEthereumNetwork>DRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ProtocolGlobalParams: { UsdAddress },
        ReserveAssets,
        FallbackOracle,
        // ChainlinkAggregator,
      } = poolConfig as ICommonConfiguration;
      const lendingRateOracles = getLendingRateOracles(poolConfig);
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const AaveOracleAddress = getParamPerNetwork(poolConfig.AaveOracle, network);
      const lendingRateOracleAddress = getParamPerNetwork(poolConfig.LendingRateOracle, network);
      const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      // const chainlinkAggregators = await getParamPerNetwork(ChainlinkAggregator, network);

      const tokensToWatch: SymbolMap<string> = {
        ...reserveAssets,
        USD: UsdAddress,
      };
      // const [tokens, aggregators] = getPairsTokenAggregator(tokensToWatch, chainlinkAggregators);

      const [tokens, indexes] = getPairTokenIndexes(network);

      let oracle = '0xbc0453F6FAC74FB46223EA5CC55Bd82852f0C670';

      const AaveOracle = notFalsyOrZeroAddress(AaveOracleAddress)
        ? await getAaveOracle(AaveOracleAddress)
        : await deployAaveOracle(
            [
              tokens,
              indexes,
              '0x4200000000000000000000000000000000000006',
              fallbackOracleAddress,
              oracle,
            ],
            verify
          );

      const lendingRateOracle = notFalsyOrZeroAddress(lendingRateOracleAddress)
        ? await getLendingRateOracle(lendingRateOracleAddress)
        : await deployLendingRateOracle(verify);
      const { USD, ...tokensAddressesWithoutUsd } = tokensToWatch;

      if (!lendingRateOracleAddress) {
        await setInitialMarketRatesInRatesOracleByHelper(
          lendingRateOracles,
          tokensAddressesWithoutUsd,
          lendingRateOracle,
          admin
        );
      }

      // Register the proxy price provider on the addressesProvider
      await waitForTx(await addressesProvider.setPriceOracle(AaveOracle.address));
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    } catch (error) {
      throw error;
    }
  });
