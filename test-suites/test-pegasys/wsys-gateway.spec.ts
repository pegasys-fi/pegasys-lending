import { MAX_UINT_AMOUNT } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { parseEther } from 'ethers/lib/utils';
import { DRE, waitForTx } from '../../helpers/misc-utils';
import { BigNumber } from 'ethers';
import { getStableDebtToken, getVariableDebtToken } from '../../helpers/contracts-getters';
import { deploySelfdestructTransferMock } from '../../helpers/contracts-deployments';

const { expect } = require('chai');

makeSuite('Use native SYS at LendingPool via WSYSGateway', (testEnv: TestEnv) => {
  const zero = BigNumber.from('0');
  const depositSize = parseEther('5');
  const daiSize = parseEther('10000');
  it('Deposit WSYS via WethGateway and DAI', async () => {
    const { users, wsysGateway, aWSYS, pool } = testEnv;

    const user = users[1];
    const depositor = users[0];

    // Deposit liquidity with native SYS
    await wsysGateway
      .connect(depositor.signer)
      .depositSYS(pool.address, depositor.address, '0', { value: depositSize });

    // Deposit with native SYS
    await wsysGateway
      .connect(user.signer)
      .depositSYS(pool.address, user.address, '0', { value: depositSize });

    const aTokensBalance = await aWSYS.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);
  });

  it('Withdraw WSYS - Partial', async () => {
    const { users, wsysGateway, aWSYS, pool } = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const aTokensBalance = await aWSYS.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero, 'User should have aTokens.');

    // Partially withdraw native SYS
    const partialWithdraw = await convertToCurrencyDecimals(aWSYS.address, '2');

    // Approve the aTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await aWSYS
      .connect(user.signer)
      .approve(wsysGateway.address, MAX_UINT_AMOUNT);
    const { gasUsed: approveGas } = await waitForTx(approveTx);

    // Partial Withdraw and send native Ether to user
    const { gasUsed: withdrawGas } = await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .withdrawSYS(pool.address, partialWithdraw, user.address)
    );

    const afterPartialEtherBalance = await user.signer.getBalance();
    const afterPartialATokensBalance = await aWSYS.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(approveTx.gasPrice);

    expect(afterPartialEtherBalance).to.be.equal(
      priorEthersBalance.add(partialWithdraw).sub(gasCosts),
      'User SYSER balance should contain the partial withdraw'
    );
    expect(afterPartialATokensBalance).to.be.equal(
      aTokensBalance.sub(partialWithdraw),
      'User aWSYS balance should be substracted'
    );
  });

  it('Withdraw WSYS - Full', async () => {
    const { users, aWSYS, wsysGateway, pool } = testEnv;

    const user = users[1];
    const priorEthersBalance = await user.signer.getBalance();
    const aTokensBalance = await aWSYS.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero, 'User should have aTokens.');

    // Approve the aTokens to Gateway so Gateway can withdraw and convert to Ether
    const approveTx = await aWSYS
      .connect(user.signer)
      .approve(wsysGateway.address, MAX_UINT_AMOUNT);
    const { gasUsed: approveGas } = await waitForTx(approveTx);

    // Full withdraw
    const { gasUsed: withdrawGas } = await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .withdrawSYS(pool.address, MAX_UINT_AMOUNT, user.address)
    );

    const afterFullEtherBalance = await user.signer.getBalance();
    const afterFullATokensBalance = await aWSYS.balanceOf(user.address);
    const gasCosts = approveGas.add(withdrawGas).mul(approveTx.gasPrice);

    expect(afterFullEtherBalance).to.be.eq(
      priorEthersBalance.add(aTokensBalance).sub(gasCosts),
      'User SYSER balance should contain the full withdraw'
    );
    expect(afterFullATokensBalance).to.be.eq(0, 'User aWSYS balance should be zero');
  });

  it('Borrow stable WSYS and Full Repay with SYS', async () => {
    const { users, wsysGateway, aDai, wsys, dai, pool, helpersContract } = testEnv;
    const borrowSize = parseEther('1');
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const user = users[1];
    const depositor = users[0];

    // Deposit with native SYS
    await wsysGateway
      .connect(depositor.signer)
      .depositSYS(pool.address, depositor.address, '0', { value: depositSize });

    const { stableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      wsys.address
    );

    const stableDebtToken = await getStableDebtToken(stableDebtTokenAddress);

    // Deposit 10000 DAI
    await dai.connect(user.signer).mint(daiSize);
    await dai.connect(user.signer).approve(pool.address, daiSize);
    await pool.connect(user.signer).deposit(dai.address, daiSize, user.address, '0');

    const aTokensBalance = await aDai.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(daiSize);

    // Borrow WSYS with WSYS as collateral
    await waitForTx(
      await pool.connect(user.signer).borrow(wsys.address, borrowSize, '1', '0', user.address)
    );

    const debtBalance = await stableDebtToken.balanceOf(user.address);

    expect(debtBalance).to.be.gt(zero);

    // Full Repay WSYS with native SYS
    await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .repaySYS(pool.address, MAX_UINT_AMOUNT, '1', user.address, { value: repaySize })
    );

    const debtBalanceAfterRepay = await stableDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterRepay).to.be.eq(zero);

    // Withdraw DAI
    await aDai.connect(user.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool.connect(user.signer).withdraw(dai.address, MAX_UINT_AMOUNT, user.address);
  });

  it('Borrow variable WSYS and Full Repay with SYS', async () => {
    const { users, wsysGateway, aWSYS, wsys, pool, helpersContract } = testEnv;
    const borrowSize = parseEther('1');
    const repaySize = borrowSize.add(borrowSize.mul(5).div(100));
    const user = users[1];

    const { variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      wsys.address
    );

    const varDebtToken = await getVariableDebtToken(variableDebtTokenAddress);

    // Deposit with native SYS
    await wsysGateway
      .connect(user.signer)
      .depositSYS(pool.address, user.address, '0', { value: depositSize });

    const aTokensBalance = await aWSYS.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);

    // Borrow WSYS with WSYS as collateral
    await waitForTx(
      await pool.connect(user.signer).borrow(wsys.address, borrowSize, '2', '0', user.address)
    );

    const debtBalance = await varDebtToken.balanceOf(user.address);

    expect(debtBalance).to.be.gt(zero);

    // Partial Repay WSYS loan with native SYS
    const partialPayment = repaySize.div(2);
    await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .repaySYS(pool.address, partialPayment, '2', user.address, { value: partialPayment })
    );

    const debtBalanceAfterPartialRepay = await varDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterPartialRepay).to.be.lt(debtBalance);

    // Full Repay WSYS loan with native SYS
    await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .repaySYS(pool.address, MAX_UINT_AMOUNT, '2', user.address, { value: repaySize })
    );
    const debtBalanceAfterFullRepay = await varDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterFullRepay).to.be.eq(zero);
  });

  it('Borrow SYS via delegateApprove SYS and repays back', async () => {
    const { users, wsysGateway, aWSYS, wsys, helpersContract, pool } = testEnv;
    const borrowSize = parseEther('1');
    const user = users[2];
    const { variableDebtTokenAddress } = await helpersContract.getReserveTokensAddresses(
      wsys.address
    );
    const varDebtToken = await getVariableDebtToken(variableDebtTokenAddress);

    const priorDebtBalance = await varDebtToken.balanceOf(user.address);
    expect(priorDebtBalance).to.be.eq(zero);

    // Deposit WSYS with native SYS
    await wsysGateway
      .connect(user.signer)
      .depositSYS(pool.address, user.address, '0', { value: depositSize });

    const aTokensBalance = await aWSYS.balanceOf(user.address);

    expect(aTokensBalance).to.be.gt(zero);
    expect(aTokensBalance).to.be.gte(depositSize);

    // Delegates borrowing power of WSYS to WSYSGateway
    await waitForTx(
      await varDebtToken.connect(user.signer).approveDelegation(wsysGateway.address, borrowSize)
    );

    // Borrows SYS with WSYS as collateral
    await waitForTx(
      await wsysGateway.connect(user.signer).borrowSYS(pool.address, borrowSize, '2', '0')
    );

    const debtBalance = await varDebtToken.balanceOf(user.address);

    expect(debtBalance).to.be.gt(zero);

    // Full Repay WSYS loan with native SYS
    await waitForTx(
      await wsysGateway
        .connect(user.signer)
        .repaySYS(pool.address, MAX_UINT_AMOUNT, '2', user.address, { value: borrowSize.mul(2) })
    );
    const debtBalanceAfterFullRepay = await varDebtToken.balanceOf(user.address);
    expect(debtBalanceAfterFullRepay).to.be.eq(zero);
  });

  it('Should revert if receiver function receives Ether if not WSYS', async () => {
    const { users, wsysGateway } = testEnv;
    const user = users[0];
    const amount = parseEther('1');

    // Call receiver function (empty data + value)
    await expect(
      user.signer.sendTransaction({
        to: wsysGateway.address,
        value: amount,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith('Receive not allowed');
  });

  it('Should revert if fallback functions is called with Ether', async () => {
    const { users, wsysGateway } = testEnv;
    const user = users[0];
    const amount = parseEther('1');
    const fakeABI = ['function wantToCallFallback()'];
    const abiCoder = new DRE.ethers.utils.Interface(fakeABI);
    const fakeMethodEncoded = abiCoder.encodeFunctionData('wantToCallFallback', []);

    // Call fallback function with value
    await expect(
      user.signer.sendTransaction({
        to: wsysGateway.address,
        data: fakeMethodEncoded,
        value: amount,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith('Fallback not allowed');
  });

  it('Should revert if fallback functions is called', async () => {
    const { users, wsysGateway } = testEnv;
    const user = users[0];

    const fakeABI = ['function wantToCallFallback()'];
    const abiCoder = new DRE.ethers.utils.Interface(fakeABI);
    const fakeMethodEncoded = abiCoder.encodeFunctionData('wantToCallFallback', []);

    // Call fallback function without value
    await expect(
      user.signer.sendTransaction({
        to: wsysGateway.address,
        data: fakeMethodEncoded,
        gasLimit: DRE.network.config.gas,
      })
    ).to.be.revertedWith('Fallback not allowed');
  });

  it('Owner can do emergency token recovery', async () => {
    const { users, dai, wsysGateway, deployer } = testEnv;
    const user = users[0];
    const amount = parseEther('1');

    await dai.connect(user.signer).mint(amount);
    const daiBalanceAfterMint = await dai.balanceOf(user.address);

    await dai.connect(user.signer).transfer(wsysGateway.address, amount);
    const daiBalanceAfterBadTransfer = await dai.balanceOf(user.address);
    expect(daiBalanceAfterBadTransfer).to.be.eq(
      daiBalanceAfterMint.sub(amount),
      'User should have lost the funds here.'
    );

    await wsysGateway
      .connect(deployer.signer)
      .emergencyTokenTransfer(dai.address, user.address, amount);
    const daiBalanceAfterRecovery = await dai.balanceOf(user.address);

    expect(daiBalanceAfterRecovery).to.be.eq(
      daiBalanceAfterMint,
      'User should recover the funds due emergency token transfer'
    );
  });

  it('Owner can do emergency native SYS recovery', async () => {
    const { users, wsysGateway, deployer } = testEnv;
    const user = users[0];
    const amount = parseEther('1');
    const userBalancePriorCall = await user.signer.getBalance();

    // Deploy contract with payable selfdestruct contract
    const selfdestructContract = await deploySelfdestructTransferMock();

    // Selfdestruct the mock, pointing to WSYSGateway address
    const callTx = await selfdestructContract
      .connect(user.signer)
      .destroyAndTransfer(wsysGateway.address, { value: amount });
    const { gasUsed } = await waitForTx(callTx);
    const gasFees = gasUsed.mul(callTx.gasPrice);
    const userBalanceAfterCall = await user.signer.getBalance();

    expect(userBalanceAfterCall).to.be.eq(userBalancePriorCall.sub(amount).sub(gasFees), '');
    ('User should have lost the funds');

    // Recover the funds from the contract and sends back to the user
    await wsysGateway.connect(deployer.signer).emergencyEtherTransfer(user.address, amount);

    const userBalanceAfterRecovery = await user.signer.getBalance();
    const wsysGatewayAfterRecovery = await DRE.ethers.provider.getBalance(wsysGateway.address);

    expect(userBalanceAfterRecovery).to.be.eq(
      userBalancePriorCall.sub(gasFees),
      'User should recover the funds due emergency sys transfer.'
    );
    expect(wsysGatewayAfterRecovery).to.be.eq('0', 'WSYSGateway ether balance should be zero.');
  });
});
