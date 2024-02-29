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
  ATokenNamePrefix: 'Aave interest bearing',
  StableDebtTokenNamePrefix: 'Aave stable debt bearing',
  VariableDebtTokenNamePrefix: 'Aave variable debt bearing',
  SymbolPrefix: '',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
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
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    TUSD: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    SUSD: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    BAT: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    AAVE: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LINK: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    KNC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    MKR: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    MANA: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    ZRX: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    SNX: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    YFI: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    REN: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    UNI: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    ENJ: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    BUSD: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.hardhat]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.hardhat]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.main]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
    [eEthereumNetwork.hardhat]: '0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F',
  },
  LendingRateOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '', //'',
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
  WethGateway: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  AaveOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
  
  ChainlinkAggregator: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {
      AAVE: '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      WETH: '0x9b26214bEC078E68a394AaEbfbffF406Ce14893F',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.hardhat]:
      '',
    [eEthereumNetwork.main]: '',
  },
  WETH: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.main]: '0x4200000000000000000000000000000000000006',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.main]: '0x4200000000000000000000000000000000000006',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
};
