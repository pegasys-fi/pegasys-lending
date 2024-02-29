import BigNumber from 'bignumber.js';
import {
  oneEther,
  oneRay,
  RAY,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave AMM Market',
  StableDebtTokenNamePrefix: 'Aave AMM Market stable debt',
  VariableDebtTokenNamePrefix: 'Aave AMM Market variable debt',
  SymbolPrefix: 'Amm',
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
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDT: {
      borrowRate: oneRay.multipliedBy(0.035).toFixed(),
    },
    WBTC: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    UniDAIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniAAVEWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniBATWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniDAIUSDC: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniCRVWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniLINKWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniMKRWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniRENWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniSNXWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniUNIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniUSDCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniWBTCUSDC: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    UniYFIWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    BptWBTCWETH: {
      borrowRate: oneRay.multipliedBy(0.05).toFixed(),
    },
    BptBALWETH: {
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
    [eEthereumNetwork.hardhat]: "0x5B024AfAaaed10bA2788fdDCd7b72Af60A854D2F",
  },
  LendingRateOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',  // Need to re-deploy because of onlyOwner
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
    [eEthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',  // Need to re-deploy because of onlyOwner
  },
  FallbackOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.hardhat]: {},

    [eEthereumNetwork.main]: {
      USDT: '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46',
      WBTC: '0xdeb288F737066589598e9214E782fa5A8eD689e8',
      USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
      UniWBTCWETH: '0x7004BB6F2013F13C54899309cCa029B49707E547',
      UniAAVEWETH: '0xB525547968610395B60085bDc8033FFeaEaa5F64',
      UniUSDCWETH: '0x71c4a2173CE3620982DC8A7D870297533360Da4E',
      UniWBTCUSDC: '0x11f4ba2227F21Dc2A9F0b0e6Ea740369d580a212',
      USD: '0x9326BFA02ADD2366b30bacB125260Af641031331',
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
    [eEthereumNetwork.main]: "0xc981ec845488b8479539e6B22dc808Fb824dB00a",
  },
};
