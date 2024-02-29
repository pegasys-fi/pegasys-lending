import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IAmmConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyDAI,
  strategyUSDC,
  strategyUSDT,
  strategyWETH,
  strategyWBTC,
  strategyWBTCWETH,
  strategyDAIWETH,
  strategyAAVEWETH,
  strategyBATWETH,
  strategyDAIUSDC,
  strategyCRVWETH,
  strategyLINKWETH,
  strategyMKRWETH,
  strategyRENWETH,
  strategySNXWETH,
  strategyUNIWETH,
  strategyUSDCWETH,
  strategyWBTCUSDC,
  strategyYFIWETH,
  strategyBALWETH,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AmmConfig: IAmmConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave AMM market',
  ProviderId: 2,
  ReservesConfig: {
    WETH: strategyWETH,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    UniWBTCWETH: strategyWBTCWETH,
    UniAAVEWETH: strategyAAVEWETH,
    UniUSDCWETH: strategyUSDCWETH,
    UniWBTCUSDC: strategyWBTCUSDC,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.main]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      UniWBTCWETH: '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940',
      UniAAVEWETH: '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f',
      UniUSDCWETH: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
      UniWBTCUSDC: '0x004375Dff511095CC5A197A54140a24eFEF3A416',
    },
  },
};

export default AmmConfig;
