import path from 'path';
import fs from 'fs';

require('dotenv').config();

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomicfoundation/hardhat-verify';

import 'hardhat-gas-reporter';
import 'hardhat-typechain';
import '@tenderly/hardhat-tenderly';
import 'solidity-coverage';

const SKIP_LOAD = process.env.SKIP_LOAD === 'true';
const PRIVATE_KEY =
	process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001"


// Prevent to load scripts before compilation and typechain
if (!SKIP_LOAD) {
  ['misc', 'migrations', 'dev', 'full', 'verifications', 'deployments', 'helpers'].forEach(
    (folder) => {
      const tasksPath = path.join(__dirname, 'tasks', folder);
      fs.readdirSync(tasksPath)
        .filter((pth) => pth.includes('.ts'))
        .forEach((task) => {
          require(`${tasksPath}/${task}`);
        });
    }
  );
}

require(`${path.join(__dirname, 'tasks/misc')}/set-bre.ts`);



const buidlerConfig = {
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'istanbul',
    },
  },
  // typechain: {
  //   outDir: 'types',
  //   target: 'ethers-v5',
  // },
  etherscan: {
    apiKey: {
      main: "abc" // Set to an empty string or some placeholder
    },
    customChains: [
      {
        network: "main",
        chainId: 570,
        urls: {
          apiURL: "https://explorer.rollux.com/api",
          browserURL: "https://explorer.rollux.com/"
        }
      }
    ]
  },
  networks: {
    main: {
      chainId: 570,
      url: "https://rpc.rollux.com",
      accounts: [PRIVATE_KEY]
    },
  },
};

export default buidlerConfig;
