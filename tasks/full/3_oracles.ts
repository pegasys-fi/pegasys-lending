import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { deployPegasysOracle, deployLendingRateOracle } from '../../helpers/contracts-deployments';
import { setInitialMarketRatesInRatesOracleByHelper } from '../../helpers/oracles-helpers';
import { ICommonConfiguration, eEthereumNetwork, SymbolMap } from '../../helpers/types';
import { waitForTx, notFalsyOrZeroAddress } from '../../helpers/misc-utils';
import {
  ConfigNames,
  loadPoolConfig,
  getWsysAddress,
  getGenesisPoolAdmin,
  getLendingRateOracles,
} from '../../helpers/configuration';
import {
  getPegasysOracle,
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
        SupraOracle,
      } = poolConfig as ICommonConfiguration;
      const lendingRateOracles = getLendingRateOracles(poolConfig);
      const addressesProvider = await getLendingPoolAddressesProvider();
      const admin = await getGenesisPoolAdmin(poolConfig);
      const PegasysOracleAddress = getParamPerNetwork(poolConfig.PegasysOracle, network);
      const lendingRateOracleAddress = getParamPerNetwork(poolConfig.LendingRateOracle, network);
      const fallbackOracleAddress = await getParamPerNetwork(FallbackOracle, network);
      const reserveAssets = await getParamPerNetwork(ReserveAssets, network);
      const oracle = await getParamPerNetwork(SupraOracle, network);

      const tokensToWatch: SymbolMap<string> = {
        ...reserveAssets,
        USD: UsdAddress,
      };

      const [tokens, indexes] = getPairTokenIndexes(network);

      const PegasysOracle = notFalsyOrZeroAddress(PegasysOracleAddress)
        ? await getPegasysOracle(PegasysOracleAddress)
        : await deployPegasysOracle(
            [
              tokens,
              indexes,
              oracle,
              fallbackOracleAddress,
              '0x0000000000000000000000000000000000000000',
              '100000000',
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
      await waitForTx(await addressesProvider.setPriceOracle(PegasysOracle.address));
      await waitForTx(await addressesProvider.setLendingRateOracle(lendingRateOracle.address));
    } catch (error) {
      throw error;
    }
  });
