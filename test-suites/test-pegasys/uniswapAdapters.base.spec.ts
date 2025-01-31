import { makeSuite, TestEnv } from './helpers/make-suite';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { getMockUniswapRouter } from '../../helpers/contracts-getters';
import { MockUniswapV2Router02 } from '../../typechain/MockUniswapV2Router02';
import BigNumber from 'bignumber.js';
import { evmRevert, evmSnapshot } from '../../helpers/misc-utils';
import { ethers } from 'ethers';
import { USD_ADDRESS } from '../../helpers/constants';
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

  describe('BaseUniswapAdapter', () => {
    describe('getAmountsOut', () => {
      it('should return the estimated amountOut and prices for the asset swap', async () => {
        const { wsys, dai, uniswapLiquiditySwapAdapter, oracle } = testEnv;

        const amountIn = parseEther('1');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.sub(flashloanPremium);

        const wsysPrice = await oracle.getAssetPrice(wsys.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const expectedDaiAmount = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountToSwap.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const outPerInPrice = amountToSwap
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(expectedDaiAmount.mul(parseEther('1')));
        const ethUsdValue = amountIn
          .mul(wsysPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));
        const daiUsdValue = expectedDaiAmount
          .mul(daiPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountOut(
          amountToSwap,
          wsys.address,
          dai.address,
          expectedDaiAmount
        );

        const result = await uniswapLiquiditySwapAdapter.getAmountsOut(
          amountIn,
          wsys.address,
          dai.address
        );

        expect(result['0']).to.be.eq(expectedDaiAmount);
        expect(result['1']).to.be.eq(outPerInPrice);
        expect(result['2']).to.be.eq(ethUsdValue);
        expect(result['3']).to.be.eq(daiUsdValue);
      });
      it('should work correctly with different decimals', async () => {
        const { pegasys, usdc, uniswapLiquiditySwapAdapter, oracle } = testEnv;

        const amountIn = parseEther('10');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.sub(flashloanPremium);

        const pegasysPrice = await oracle.getAssetPrice(pegasys.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const expectedUSDCAmount = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountToSwap.toString()).div(usdcPrice.toString()).toFixed(0)
        );

        const outPerInPrice = amountToSwap
          .mul(parseEther('1'))
          .mul('1000000') // usdc 6 decimals
          .div(expectedUSDCAmount.mul(parseEther('1')));

        const pegasysUsdValue = amountIn
          .mul(pegasysPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        const usdcUsdValue = expectedUSDCAmount
          .mul(usdcPrice)
          .div('1000000') // usdc 6 decimals
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountOut(
          amountToSwap,
          pegasys.address,
          usdc.address,
          expectedUSDCAmount
        );

        const result = await uniswapLiquiditySwapAdapter.getAmountsOut(
          amountIn,
          pegasys.address,
          usdc.address
        );

        expect(result['0']).to.be.eq(expectedUSDCAmount);
        expect(result['1']).to.be.eq(outPerInPrice);
        expect(result['2']).to.be.eq(pegasysUsdValue);
        expect(result['3']).to.be.eq(usdcUsdValue);
      });
    });

    describe('getAmountsIn', () => {
      it('should return the estimated required amountIn for the asset swap', async () => {
        const { wsys, dai, uniswapLiquiditySwapAdapter, oracle } = testEnv;

        const amountIn = parseEther('1');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.add(flashloanPremium);

        const wsysPrice = await oracle.getAssetPrice(wsys.address);
        const daiPrice = await oracle.getAssetPrice(dai.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const amountOut = await convertToCurrencyDecimals(
          dai.address,
          new BigNumber(amountIn.toString()).div(daiPrice.toString()).toFixed(0)
        );

        const inPerOutPrice = amountOut
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(amountToSwap.mul(parseEther('1')));

        const ethUsdValue = amountToSwap
          .mul(wsysPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));
        const daiUsdValue = amountOut
          .mul(daiPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountIn(amountOut, wsys.address, dai.address, amountIn);

        const result = await uniswapLiquiditySwapAdapter.getAmountsIn(
          amountOut,
          wsys.address,
          dai.address
        );

        expect(result['0']).to.be.eq(amountToSwap);
        expect(result['1']).to.be.eq(inPerOutPrice);
        expect(result['2']).to.be.eq(ethUsdValue);
        expect(result['3']).to.be.eq(daiUsdValue);
      });
      it('should work correctly with different decimals', async () => {
        const { pegasys, usdc, uniswapLiquiditySwapAdapter, oracle } = testEnv;

        const amountIn = parseEther('10');
        const flashloanPremium = amountIn.mul(9).div(10000);
        const amountToSwap = amountIn.add(flashloanPremium);

        const pegasysPrice = await oracle.getAssetPrice(pegasys.address);
        const usdcPrice = await oracle.getAssetPrice(usdc.address);
        const usdPrice = await oracle.getAssetPrice(USD_ADDRESS);

        const amountOut = await convertToCurrencyDecimals(
          usdc.address,
          new BigNumber(amountToSwap.toString()).div(usdcPrice.toString()).toFixed(0)
        );

        const inPerOutPrice = amountOut
          .mul(parseEther('1'))
          .mul(parseEther('1'))
          .div(amountToSwap.mul('1000000')); // usdc 6 decimals

        const pegasysUsdValue = amountToSwap
          .mul(pegasysPrice)
          .div(parseEther('1'))
          .mul(usdPrice)
          .div(parseEther('1'));

        const usdcUsdValue = amountOut
          .mul(usdcPrice)
          .div('1000000') // usdc 6 decimals
          .mul(usdPrice)
          .div(parseEther('1'));

        await mockUniswapRouter.setAmountIn(amountOut, pegasys.address, usdc.address, amountIn);

        const result = await uniswapLiquiditySwapAdapter.getAmountsIn(
          amountOut,
          pegasys.address,
          usdc.address
        );

        expect(result['0']).to.be.eq(amountToSwap);
        expect(result['1']).to.be.eq(inPerOutPrice);
        expect(result['2']).to.be.eq(pegasysUsdValue);
        expect(result['3']).to.be.eq(usdcUsdValue);
      });
    });
  });
});
