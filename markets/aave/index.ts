import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IAaveConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyUSDC,
  strategyUSDT,
  strategyWSYS,
  strategyWBTC,
  strategyWETH,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AaveConfig: IAaveConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave genesis market',
  ProviderId: 1,
  ReservesConfig: {
    WSYS: strategyWSYS,
    USDC: strategyUSDC,
    USDT: strategyUSDT,
    WBTC: strategyWBTC,
    WETH: strategyWETH,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {
      WSYS: '0x4200000000000000000000000000000000000006',
      USDC: '0x368433CaC2A0B8D76E64681a9835502a1f2A8A30',
      USDT: '0x28c9c7Fb3fE3104d2116Af26cC8eF7905547349c',
      WBTC: '0x2A4DC2e946b92AB4a1f7D62844EB237788F9056c',
      WETH: '0xaA1c53AFd099E415208F47FCFA2C880f659E6904',
    },
    [eEthereumNetwork.main]: {
      WSYS: '0x4200000000000000000000000000000000000006',
      USDC: '0x368433CaC2A0B8D76E64681a9835502a1f2A8A30',
      USDT: '0x28c9c7Fb3fE3104d2116Af26cC8eF7905547349c',
      WBTC: '0x2A4DC2e946b92AB4a1f7D62844EB237788F9056c',
      WETH: '0xaA1c53AFd099E415208F47FCFA2C880f659E6904',
    },
  },
};

export default AaveConfig;
