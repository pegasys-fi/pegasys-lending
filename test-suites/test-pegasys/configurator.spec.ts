import { TestEnv, makeSuite } from './helpers/make-suite';
import { APPROVAL_AMOUNT_LENDING_POOL, RAY } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { ProtocolErrors } from '../../helpers/types';
import { strategyWSYS } from '../../markets/pegasys/reservesConfigs';

const { expect } = require('chai');

makeSuite('LendingPoolConfigurator', (testEnv: TestEnv) => {
  const {
    CALLER_NOT_POOL_ADMIN,
    LPC_RESERVE_LIQUIDITY_NOT_0,
    RC_INVALID_LTV,
    RC_INVALID_LIQ_THRESHOLD,
    RC_INVALID_LIQ_BONUS,
    RC_INVALID_DECIMALS,
    RC_INVALID_RESERVE_FACTOR,
  } = ProtocolErrors;

  it('Reverts trying to set an invalid reserve factor', async () => {
    const { configurator, wsys } = testEnv;

    const invalidReserveFactor = 65536;

    await expect(
      configurator.setReserveFactor(wsys.address, invalidReserveFactor)
    ).to.be.revertedWith(RC_INVALID_RESERVE_FACTOR);
  });

  it('Deactivates the SYS reserve', async () => {
    const { configurator, wsys, helpersContract } = testEnv;
    await configurator.deactivateReserve(wsys.address);
    const { isActive } = await helpersContract.getReserveConfigurationData(wsys.address);
    expect(isActive).to.be.equal(false);
  });

  it('Rectivates the SYS reserve', async () => {
    const { configurator, wsys, helpersContract } = testEnv;
    await configurator.activateReserve(wsys.address);

    const { isActive } = await helpersContract.getReserveConfigurationData(wsys.address);
    expect(isActive).to.be.equal(true);
  });

  it('Check the onlyPegasysAdmin on deactivateReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).deactivateReserve(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlyPegasysAdmin on activateReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).activateReserve(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Freezes the SYS reserve', async () => {
    const { configurator, wsys, helpersContract } = testEnv;

    await configurator.freezeReserve(wsys.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(true);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Unfreezes the SYS reserve', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.unfreezeReserve(wsys.address);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Check the onlyPegasysAdmin on freezeReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).freezeReserve(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlyPegasysAdmin on unfreezeReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).unfreezeReserve(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the SYS reserve for borrowing', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.disableBorrowingOnReserve(wsys.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(false);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Activates the SYS reserve for borrowing', async () => {
    const { configurator, wsys, helpersContract } = testEnv;
    await configurator.enableBorrowingOnReserve(wsys.address, true);
    const { variableBorrowIndex } = await helpersContract.getReserveData(wsys.address);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);

    expect(variableBorrowIndex.toString()).to.be.equal(RAY);
  });

  it('Check the onlyPegasysAdmin on disableBorrowingOnReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableBorrowingOnReserve(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlyPegasysAdmin on enableBorrowingOnReserve ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableBorrowingOnReserve(wsys.address, true),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Deactivates the SYS reserve as collateral', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.configureReserveAsCollateral(wsys.address, 0, 0, 0);

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(18);
    expect(ltv).to.be.equal(0);
    expect(liquidationThreshold).to.be.equal(0);
    expect(liquidationBonus).to.be.equal(0);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Activates the SYS reserve as collateral', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.configureReserveAsCollateral(wsys.address, '8000', '8250', '10500');

    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Check the onlyPegasysAdmin on configureReserveAsCollateral ', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator
        .connect(users[2].signer)
        .configureReserveAsCollateral(wsys.address, '7500', '8000', '10500'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Disable stable borrow rate on the SYS reserve', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.disableReserveStableRate(wsys.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(false);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Enables stable borrow rate on the SYS reserve', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.enableReserveStableRate(wsys.address);
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(true);
    expect(reserveFactor).to.be.equal(strategyWSYS.reserveFactor);
  });

  it('Check the onlyPegasysAdmin on disableReserveStableRate', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).disableReserveStableRate(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Check the onlyPegasysAdmin on enableReserveStableRate', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).enableReserveStableRate(wsys.address),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Changes the reserve factor of WSYS', async () => {
    const { configurator, helpersContract, wsys } = testEnv;
    await configurator.setReserveFactor(wsys.address, '1000');
    const {
      decimals,
      ltv,
      liquidationBonus,
      liquidationThreshold,
      reserveFactor,
      stableBorrowRateEnabled,
      borrowingEnabled,
      isActive,
      isFrozen,
    } = await helpersContract.getReserveConfigurationData(wsys.address);

    expect(borrowingEnabled).to.be.equal(true);
    expect(isActive).to.be.equal(true);
    expect(isFrozen).to.be.equal(false);
    expect(decimals).to.be.equal(strategyWSYS.reserveDecimals);
    expect(ltv).to.be.equal(strategyWSYS.baseLTVAsCollateral);
    expect(liquidationThreshold).to.be.equal(strategyWSYS.liquidationThreshold);
    expect(liquidationBonus).to.be.equal(strategyWSYS.liquidationBonus);
    expect(stableBorrowRateEnabled).to.be.equal(strategyWSYS.stableBorrowRateEnabled);
    expect(reserveFactor).to.be.equal(1000);
  });

  it('Check the onlyLendingPoolManager on setReserveFactor', async () => {
    const { configurator, users, wsys } = testEnv;
    await expect(
      configurator.connect(users[2].signer).setReserveFactor(wsys.address, '2000'),
      CALLER_NOT_POOL_ADMIN
    ).to.be.revertedWith(CALLER_NOT_POOL_ADMIN);
  });

  it('Reverts when trying to disable the DAI reserve with liquidity on it', async () => {
    const { dai, pool, configurator } = testEnv;
    const userAddress = await pool.signer.getAddress();
    await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

    //approve protocol to access depositor wallet
    await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);
    const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

    //user 1 deposits 1000 DAI
    await pool.deposit(dai.address, amountDAItoDeposit, userAddress, '0');

    await expect(
      configurator.deactivateReserve(dai.address),
      LPC_RESERVE_LIQUIDITY_NOT_0
    ).to.be.revertedWith(LPC_RESERVE_LIQUIDITY_NOT_0);
  });
});
