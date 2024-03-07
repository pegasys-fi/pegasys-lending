import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneEther,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Pegasys interest bearing',
  StableDebtTokenNamePrefix: 'Pegasys stable debt bearing',
  VariableDebtTokenNamePrefix: 'Pegasys variable debt bearing',
  SymbolPrefix: '',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: '100000000',
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '100000000',
    UsdAddress: '0x0000000000000000000000000000000000000000',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    PegasysReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    WSYS: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    ETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    BTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.hardhat]: "",
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: "",
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  LendingRateOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  LendingPool: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  WsysGateway: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  PegasysOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
  SupraOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '0xbc0453F6FAC74FB46223EA5CC55Bd82852f0C670'
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.hardhat]:'',
    [eEthereumNetwork.main]: '',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.hardhat]: '0x4200000000000000000000000000000000000006', // deployed in local evm
    [eEthereumNetwork.main]: '0x4200000000000000000000000000000000000006',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '0x4d523e1a7650b37302E613B509bAfc14Fbc236a0',
  },
};
