import {
  PegasysPools,
  iMultiPoolsAssets,
  IReserveParams,
  PoolConfiguration,
  eNetwork,
  IBaseConfiguration,
} from './types';
import { getEthersSignersAddresses, getParamPerPool } from './contracts-helpers';
import PegasysConfig from '../markets/pegasys';

import { CommonsConfig } from '../markets/pegasys/commons';
import { DRE, filterMapBy } from './misc-utils';
import { tEthereumAddress } from './types';
import { getParamPerNetwork } from './contracts-helpers';
import { deployWSYSMocked } from './contracts-deployments';

export enum ConfigNames {
  Commons = 'Commons',
  Pegasys = 'Pegasys',
}

export const loadPoolConfig = (configName: ConfigNames): PoolConfiguration => {
  switch (configName) {
    case ConfigNames.Pegasys:
      return PegasysConfig;
    case ConfigNames.Commons:
      return CommonsConfig;
    default:
      throw new Error(
        `Unsupported pool configuration: ${configName} is not one of the supported configs ${Object.values(
          ConfigNames
        )}`
      );
  }
};

// ----------------
// PROTOCOL PARAMS PER POOL
// ----------------

export const getReservesConfigByPool = (pool: PegasysPools): iMultiPoolsAssets<IReserveParams> =>
  getParamPerPool<iMultiPoolsAssets<IReserveParams>>(
    {
      [PegasysPools.proto]: {
        ...PegasysConfig.ReservesConfig,
      },
    },
    pool
  );

export const getGenesisPoolAdmin = async (
  config: IBaseConfiguration
): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.PoolAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.PoolAdminIndex;
  return addressList[addressIndex];
};

export const getEmergencyAdmin = async (config: IBaseConfiguration): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const targetAddress = getParamPerNetwork(config.EmergencyAdmin, <eNetwork>currentNetwork);
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await getEthersSignersAddresses();
  const addressIndex = config.EmergencyAdminIndex;
  return addressList[addressIndex];
};

export const getTreasuryAddress = async (config: IBaseConfiguration): Promise<tEthereumAddress> => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  return getParamPerNetwork(config.ReserveFactorTreasuryAddress, <eNetwork>currentNetwork);
};

export const getATokenDomainSeparatorPerNetwork = (
  network: eNetwork,
  config: IBaseConfiguration
): tEthereumAddress => getParamPerNetwork<tEthereumAddress>(config.ATokenDomainSeparator, network);

export const getWsysAddress = async (config: IBaseConfiguration) => {
  const currentNetwork = process.env.FORK ? process.env.FORK : DRE.network.name;
  const wsysAddress = getParamPerNetwork(config.WSYS, <eNetwork>currentNetwork);
  if (wsysAddress) {
    return wsysAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WSYS not set at mainnet configuration.');
  }
  const wsys = await deployWSYSMocked();
  return wsys.address;
};

export const getWrappedNativeTokenAddress = async (config: IBaseConfiguration) => {
  const currentNetwork = process.env.MAINNET_FORK === 'true' ? 'main' : DRE.network.name;
  const wsysAddress = getParamPerNetwork(config.WrappedNativeToken, <eNetwork>currentNetwork);
  if (wsysAddress) {
    return wsysAddress;
  }
  if (currentNetwork.includes('main')) {
    throw new Error('WSYS not set at mainnet configuration.');
  }
  const wsys = await deployWSYSMocked();
  return wsys.address;
};

export const getLendingRateOracles = (poolConfig: IBaseConfiguration) => {
  const {
    ProtocolGlobalParams: { UsdAddress },
    LendingRateOracleRatesCommon,
    ReserveAssets,
  } = poolConfig;

  const network = process.env.FORK ? process.env.FORK : DRE.network.name;
  return filterMapBy(LendingRateOracleRatesCommon, (key) =>
    Object.keys(ReserveAssets[network]).includes(key)
  );
};

export const getQuoteCurrency = async (config: IBaseConfiguration) => {
  switch (config.OracleQuoteCurrency) {
    case 'SYS':
    case 'WSYS':
      return getWsysAddress(config);
    case 'USD':
      return config.ProtocolGlobalParams.UsdAddress;
    default:
      throw `Quote ${config.OracleQuoteCurrency} currency not set. Add a new case to getQuoteCurrency switch`;
  }
};
