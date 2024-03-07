import { makeSuite, TestEnv } from './helpers/make-suite';
import {
  convertToCurrencyDecimals,
  getContract,
  buildPermitParams,
  getSignatureFromTypedData,
  buildLiquiditySwapParams,
} from '../../helpers/contracts-helpers';
import { getMockUniswapRouter } from '../../helpers/contracts-getters';
import { deployUniswapLiquiditySwapAdapter } from '../../helpers/contracts-deployments';
import { MockUniswapV2Router02 } from '../../typechain/MockUniswapV2Router02';
import { Zero } from '@ethersproject/constants';
import BigNumber from 'bignumber.js';
import { DRE, evmRevert, evmSnapshot } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import { eContractid } from '../../helpers/types';
import { AToken } from '../../typechain/AToken';
import { BUIDLEREVM_CHAINID } from '../../helpers/buidler-constants';
import { MAX_UINT_AMOUNT } from '../../helpers/constants';
const { parseEther } = ethers.utils;

const { expect } = require('chai');

makeSuite('Uniswap adapters', (testEnv: TestEnv) => {
  let mockUniswapRouter: MockUniswapV2Router02;
  let evmSnapshotId: string;

  before(async () => {
    mockUniswapRouter = await getMockUniswapRouter();
  });

  beforeEach(async () => {
    evmSnapshotId = await evmSnapshot();
  });

  afterEach(async () => {
    await evmRevert(evmSnapshotId);
  });

  describe('UniswapLiquiditySwapAdapter', () => {
    describe('constructor', () => {
      it('should deploy with correct parameters', async () => {
        const { addressesProvider, wsys } = testEnv;
        await deployUniswapLiquiditySwapAdapter([
          addressesProvider.address,
          mockUniswapRouter.address,
          wsys.address,
        ]);
      });

      it('should revert if not valid addresses provider', async () => {
        const { wsys } = testEnv;
        await expect(
          deployUniswapLiquiditySwapAdapter([
            mockUniswapRouter.address,
            mockUniswapRouter.address,
            wsys.address,
          ])
        ).to.be.reverted;
      });
    });

    describe('executeOperation', () => {
      beforeEach(async () => {
        const { users, wsys, dai, usdc, pool, deployer } = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        const usdcAmount = await convertToCurrencyDecimals(usdc.address, '10');
        await usdc.mint(usdcAmount);
        await usdc.approve(pool.address, usdcAmount);
        await pool.deposit(usdc.address, usdcAmount, deployer.address, 0);

        // Make a deposit for user
        await wsys.mint(parseEther('100'));
        await wsys.approve(pool.address, parseEther('100'));
        await pool.deposit(wsys.address, parseEther('100'), userAddress, 0);
      });

      it('should correctly swap tokens and deposit the out tokens in the pool', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap and deposit multiple tokens', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, usdc, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .div(new BigNumber(10).pow(principalDecimals))
            .toFixed(0)
        );

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountWSYStoSwap);
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountUSDCtoSwap);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const wsysFlashloanAmount = new BigNumber(amountWSYStoSwap.toString())
          .div(1.0009)
          .toFixed(0);
        const usdcFlashloanAmount = new BigNumber(amountUSDCtoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address, dai.address],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [false, false]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapLiquiditySwapAdapter.address,
            [wsys.address, usdc.address],
            [wsysFlashloanAmount.toString(), usdcFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWSYStoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap and deposit multiple tokens using permit', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, usdc, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;
        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .div(new BigNumber(10).pow(principalDecimals))
            .toFixed(0)
        );

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        const wsysFlashloanAmount = new BigNumber(amountWSYStoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const usdcFlashloanAmount = new BigNumber(amountUSDCtoSwap.toString())
          .div(1.0009)
          .toFixed(0);

        const aWethNonce = (await aWSYS._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          amountWSYStoSwap.toString()
        );
        const {
          v: aWSYSv,
          r: aWSYSr,
          s: aWSYSs,
        } = getSignatureFromTypedData(ownerPrivateKey, aWethMsgParams);

        const aUsdcNonce = (await aUsdc._nonces(userAddress)).toNumber();
        const aUsdcMsgParams = buildPermitParams(
          chainId,
          aUsdc.address,
          '1',
          await aUsdc.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aUsdcNonce,
          deadline,
          amountUSDCtoSwap.toString()
        );
        const {
          v: aUsdcv,
          r: aUsdcr,
          s: aUsdcs,
        } = getSignatureFromTypedData(ownerPrivateKey, aUsdcMsgParams);
        const params = buildLiquiditySwapParams(
          [dai.address, dai.address],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [0, 0],
          [amountWSYStoSwap, amountUSDCtoSwap],
          [deadline, deadline],
          [aWSYSv, aUsdcv],
          [aWSYSr, aUsdcr],
          [aWSYSs, aUsdcs],
          [false, false]
        );

        await pool
          .connect(user)
          .flashLoan(
            uniswapLiquiditySwapAdapter.address,
            [wsys.address, usdc.address],
            [wsysFlashloanAmount.toString(), usdcFlashloanAmount.toString()],
            [0, 0],
            userAddress,
            params,
            0
          );

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWSYStoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap tokens with permit', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWSYS._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [liquidityToSwap],
          [deadline],
          [v],
          [r],
          [s],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if inconsistent params', async () => {
        const { users, wsys, oracle, dai, aWSYS, pool, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params2 = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount],
          [0, 0],
          [0, 0],
          [0, 0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params2,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params3 = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount],
          [0, 0],
          [0],
          [0, 0],
          [0, 0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params3,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params4 = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params4,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params5 = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          ],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params5,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params6 = buildLiquiditySwapParams(
          [dai.address, wsys.address],
          [expectedDaiAmount, expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params6,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params7 = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0, 0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params7,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params8 = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0, 0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params8,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        const params9 = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false, false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params9,
              0
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('should revert if caller not lending pool', async () => {
        const { users, wsys, oracle, dai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          uniswapLiquiditySwapAdapter
            .connect(user)
            .executeOperation(
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params
            )
        ).to.be.revertedWith('CALLER_MUST_BE_LENDING_POOL');
      });

      it('should work correctly with tokens of different decimals', async () => {
        const { users, usdc, oracle, dai, aDai, uniswapLiquiditySwapAdapter, pool, deployer } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const liquidity = await convertToCurrencyDecimals(usdc.address, '20000');

        // Provide liquidity
        await usdc.mint(liquidity);
        await usdc.approve(pool.address, liquidity);
        await pool.deposit(usdc.address, liquidity, deployer.address, 0);

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);

        // usdc 6
        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .div(new BigNumber(10).pow(principalDecimals))
            .toFixed(0)
        );

        await mockUniswapRouter.connect(user).setAmountToReturn(usdc.address, expectedDaiAmount);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);
        const aUsdcBalance = await aUsdc.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, aUsdcBalance);
        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(amountUSDCtoSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [usdc.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(usdc.address, dai.address, flashloanAmount.toString(), expectedDaiAmount);

        const adapterUsdcBalance = await usdc.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const aDaiBalance = await aDai.balanceOf(userAddress);

        expect(adapterUsdcBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(aDaiBalance).to.be.eq(expectedDaiAmount);
      });

      it('should revert when min amount to receive exceeds the max slippage amount', async () => {
        const { users, wsys, oracle, dai, aWSYS, pool, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);
        const smallExpectedDaiAmount = expectedDaiAmount.div(2);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Subtract the FL fee from the amount to be swapped 0,09%
        const flashloanAmount = new BigNumber(liquidityToSwap.toString()).div(1.0009).toFixed(0);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [smallExpectedDaiAmount],
          [0],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [flashloanAmount.toString()],
              [0],
              userAddress,
              params,
              0
            )
        ).to.be.revertedWith('minAmountOut exceed max slippage');
      });

      it('should correctly swap tokens all the balance', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // Remove other balance
        await aWSYS.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [1],
          [0],
          [0],
          [0],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          ['0x0000000000000000000000000000000000000000000000000000000000000000'],
          [false]
        );

        // Flashloan + premium > aToken balance. Then it will only swap the balance - premium
        const flashloanFee = liquidityToSwap.mul(9).div(10000);
        const swappedAmount = liquidityToSwap.sub(flashloanFee);

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [liquidityToSwap.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, swappedAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const adapterAEthBalance = await aWSYS.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });

      it('should correctly swap tokens all the balance using permit', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, pool, uniswapLiquiditySwapAdapter } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // Remove other balance
        await aWSYS.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWSYS._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        const params = buildLiquiditySwapParams(
          [dai.address],
          [expectedDaiAmount],
          [1],
          [liquidityToSwap],
          [deadline],
          [v],
          [r],
          [s],
          [false]
        );

        // Flashloan + premium > aToken balance. Then it will only swap the balance - premium
        const flashloanFee = liquidityToSwap.mul(9).div(10000);
        const swappedAmount = liquidityToSwap.sub(flashloanFee);

        await expect(
          pool
            .connect(user)
            .flashLoan(
              uniswapLiquiditySwapAdapter.address,
              [wsys.address],
              [liquidityToSwap.toString()],
              [0],
              userAddress,
              params,
              0
            )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, swappedAmount.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const adapterAEthBalance = await aWSYS.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });
    });

    describe('swapAndDeposit', () => {
      beforeEach(async () => {
        const { users, wsys, dai, pool, deployer } = testEnv;
        const userAddress = users[0].address;

        // Provide liquidity
        await dai.mint(parseEther('20000'));
        await dai.approve(pool.address, parseEther('20000'));
        await pool.deposit(dai.address, parseEther('20000'), deployer.address, 0);

        // Make a deposit for user
        await wsys.mint(parseEther('100'));
        await wsys.approve(pool.address, parseEther('100'));
        await pool.deposit(wsys.address, parseEther('100'), userAddress, 0);
      });

      it('should correctly swap tokens and deposit the out tokens in the pool', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [amountWSYStoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, amountWSYStoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should correctly swap tokens using permit', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;
        const nonce = (await aWSYS._nonces(userAddress)).toNumber();
        const msgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          nonce,
          deadline,
          liquidityToSwap.toString()
        );

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, msgParams);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [amountWSYStoSwap],
            [expectedDaiAmount],
            [
              {
                amount: liquidityToSwap,
                deadline,
                v,
                r,
                s,
              },
            ],
            [false]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, amountWSYStoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(liquidityToSwap));
      });

      it('should revert if inconsistent params', async () => {
        const { users, wsys, dai, uniswapLiquiditySwapAdapter, oracle } = testEnv;
        const user = users[0].signer;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address, dai.address],
            [dai.address],
            [amountWSYStoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address, wsys.address],
            [amountWSYStoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [amountWSYStoSwap, amountWSYStoSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter
            .connect(user)
            .swapAndDeposit(
              [wsys.address],
              [dai.address],
              [amountWSYStoSwap],
              [expectedDaiAmount],
              [],
              [false]
            )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [amountWSYStoSwap],
            [expectedDaiAmount, expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        ).to.be.revertedWith('INCONSISTENT_PARAMS');
      });

      it('should revert when min amount to receive exceeds the max slippage amount', async () => {
        const { users, wsys, oracle, dai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);
        const smallExpectedDaiAmount = expectedDaiAmount.div(2);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [amountWSYStoSwap],
            [smallExpectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        ).to.be.revertedWith('minAmountOut exceed max slippage');
      });

      it('should correctly swap tokens and deposit multiple tokens', async () => {
        const { users, wsys, usdc, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter, pool } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .div(new BigNumber(10).pow(principalDecimals))
            .toFixed(0)
        );

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountWSYStoSwap);
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);
        await aUsdc.connect(user).approve(uniswapLiquiditySwapAdapter.address, amountUSDCtoSwap);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        await uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
          [wsys.address, usdc.address],
          [dai.address, dai.address],
          [amountWSYStoSwap, amountUSDCtoSwap],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [
            {
              amount: 0,
              deadline: 0,
              v: 0,
              r: '0x0000000000000000000000000000000000000000000000000000000000000000',
              s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
            {
              amount: 0,
              deadline: 0,
              v: 0,
              r: '0x0000000000000000000000000000000000000000000000000000000000000000',
              s: '0x0000000000000000000000000000000000000000000000000000000000000000',
            },
          ],
          [false, false]
        );

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWSYStoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap tokens and deposit multiple tokens using permit', async () => {
        const { users, wsys, usdc, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter, pool } =
          testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;
        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmountForEth = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const amountUSDCtoSwap = await convertToCurrencyDecimals(usdc.address, '10');
        const usdcPrice = await oracle.getAssetPrice(usdc.address);

        const collateralDecimals = (await usdc.decimals()).toString();
        const principalDecimals = (await dai.decimals()).toString();

        const expectedDaiAmountForUsdc = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountUSDCtoSwap.toString())
            .times(
              new BigNumber(usdcPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
            )
            .div(
              new BigNumber(daiPrice.toString()).times(new BigNumber(10).pow(collateralDecimals))
            )
            .div(new BigNumber(10).pow(principalDecimals))
            .toFixed(0)
        );

        // Make a deposit for user
        await usdc.connect(user).mint(amountUSDCtoSwap);
        await usdc.connect(user).approve(pool.address, amountUSDCtoSwap);
        await pool.connect(user).deposit(usdc.address, amountUSDCtoSwap, userAddress, 0);

        const aUsdcData = await pool.getReserveData(usdc.address);
        const aUsdc = await getContract<AToken>(eContractid.AToken, aUsdcData.aTokenAddress);

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmountForEth);
        await mockUniswapRouter.setAmountToReturn(usdc.address, expectedDaiAmountForUsdc);

        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalanceBefore = await aUsdc.balanceOf(userAddress);

        const aWethNonce = (await aWSYS._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          amountWSYStoSwap.toString()
        );
        const {
          v: aWSYSv,
          r: aWSYSr,
          s: aWSYSs,
        } = getSignatureFromTypedData(ownerPrivateKey, aWethMsgParams);

        const aUsdcNonce = (await aUsdc._nonces(userAddress)).toNumber();
        const aUsdcMsgParams = buildPermitParams(
          chainId,
          aUsdc.address,
          '1',
          await aUsdc.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aUsdcNonce,
          deadline,
          amountUSDCtoSwap.toString()
        );
        const {
          v: aUsdcv,
          r: aUsdcr,
          s: aUsdcs,
        } = getSignatureFromTypedData(ownerPrivateKey, aUsdcMsgParams);

        await uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
          [wsys.address, usdc.address],
          [dai.address, dai.address],
          [amountWSYStoSwap, amountUSDCtoSwap],
          [expectedDaiAmountForEth, expectedDaiAmountForUsdc],
          [
            {
              amount: amountWSYStoSwap,
              deadline,
              v: aWSYSv,
              r: aWSYSr,
              s: aWSYSs,
            },
            {
              amount: amountUSDCtoSwap,
              deadline,
              v: aUsdcv,
              r: aUsdcr,
              s: aUsdcs,
            },
          ],
          [false, false]
        );

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const userAUsdcBalance = await aUsdc.balanceOf(userAddress);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmountForEth.add(expectedDaiAmountForUsdc));
        expect(userAEthBalance).to.be.lt(userAEthBalanceBefore);
        expect(userAEthBalance).to.be.gte(userAEthBalanceBefore.sub(amountWSYStoSwap));
        expect(userAUsdcBalance).to.be.lt(userAUsdcBalanceBefore);
        expect(userAUsdcBalance).to.be.gte(userAUsdcBalanceBefore.sub(amountUSDCtoSwap));
      });

      it('should correctly swap all the balance when using a bigger amount', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // Remove other balance
        await aWSYS.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        // User will swap liquidity 10 aEth to aDai
        await aWSYS.connect(user).approve(uniswapLiquiditySwapAdapter.address, liquidityToSwap);

        // Only has 10 atokens, so all the balance will be swapped
        const bigAmountToSwap = parseEther('100');

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [bigAmountToSwap],
            [expectedDaiAmount],
            [
              {
                amount: 0,
                deadline: 0,
                v: 0,
                r: '0x0000000000000000000000000000000000000000000000000000000000000000',
                s: '0x0000000000000000000000000000000000000000000000000000000000000000',
              },
            ],
            [false]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, amountWSYStoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const adapterAEthBalance = await aWSYS.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });

      it('should correctly swap all the balance when using permit', async () => {
        const { users, wsys, oracle, dai, aDai, aWSYS, uniswapLiquiditySwapAdapter } = testEnv;
        const user = users[0].signer;
        const userAddress = users[0].address;

        const amountWSYStoSwap = await convertToCurrencyDecimals(wsys.address, '10');

        const daiPrice = await oracle.getAssetPrice(dai.address);
        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountWSYStoSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        await mockUniswapRouter.setAmountToReturn(wsys.address, expectedDaiAmount);

        // Remove other balance
        await aWSYS.connect(user).transfer(users[1].address, parseEther('90'));
        const userAEthBalanceBefore = await aWSYS.balanceOf(userAddress);

        // User will swap liquidity 10 aEth to aDai
        const liquidityToSwap = parseEther('10');
        expect(userAEthBalanceBefore).to.be.eq(liquidityToSwap);

        // Only has 10 atokens, so all the balance will be swapped
        const bigAmountToSwap = parseEther('100');

        const chainId = DRE.network.config.chainId || BUIDLEREVM_CHAINID;
        const deadline = MAX_UINT_AMOUNT;

        const ownerPrivateKey = require('../../test-wallets.js').accounts[1].secretKey;
        if (!ownerPrivateKey) {
          throw new Error('INVALID_OWNER_PK');
        }
        const aWethNonce = (await aWSYS._nonces(userAddress)).toNumber();
        const aWethMsgParams = buildPermitParams(
          chainId,
          aWSYS.address,
          '1',
          await aWSYS.name(),
          userAddress,
          uniswapLiquiditySwapAdapter.address,
          aWethNonce,
          deadline,
          bigAmountToSwap.toString()
        );
        const { v, r, s } = getSignatureFromTypedData(ownerPrivateKey, aWethMsgParams);

        await expect(
          uniswapLiquiditySwapAdapter.connect(user).swapAndDeposit(
            [wsys.address],
            [dai.address],
            [bigAmountToSwap],
            [expectedDaiAmount],
            [
              {
                amount: bigAmountToSwap,
                deadline,
                v,
                r,
                s,
              },
            ],
            [false]
          )
        )
          .to.emit(uniswapLiquiditySwapAdapter, 'Swapped')
          .withArgs(wsys.address, dai.address, amountWSYStoSwap.toString(), expectedDaiAmount);

        const adapterWethBalance = await wsys.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiBalance = await dai.balanceOf(uniswapLiquiditySwapAdapter.address);
        const adapterDaiAllowance = await dai.allowance(
          uniswapLiquiditySwapAdapter.address,
          userAddress
        );
        const userADaiBalance = await aDai.balanceOf(userAddress);
        const userAEthBalance = await aWSYS.balanceOf(userAddress);
        const adapterAEthBalance = await aWSYS.balanceOf(uniswapLiquiditySwapAdapter.address);

        expect(adapterWethBalance).to.be.eq(Zero);
        expect(adapterDaiBalance).to.be.eq(Zero);
        expect(adapterDaiAllowance).to.be.eq(Zero);
        expect(userADaiBalance).to.be.eq(expectedDaiAmount);
        expect(userAEthBalance).to.be.eq(Zero);
        expect(adapterAEthBalance).to.be.eq(Zero);
      });
    });
  });
});
