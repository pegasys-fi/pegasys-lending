import { task } from 'hardhat/config';
import {
  loadPoolConfig,
  ConfigNames,
  getWrappedNativeTokenAddress,
} from '../../helpers/configuration';
import { deployWSYSGateway } from '../../helpers/contracts-deployments';

const CONTRACT_NAME = 'WSYSGateway';

task(`full-deploy-wsys-gateway`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');
    const poolConfig = loadPoolConfig(pool);
    const Wsys = await getWrappedNativeTokenAddress(poolConfig);

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    const wsysGateWay = await deployWSYSGateway([Wsys], verify);
    console.log(`${CONTRACT_NAME}.address`, wsysGateWay.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });
