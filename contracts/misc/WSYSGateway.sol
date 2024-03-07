// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IWSYS} from './interfaces/IWSYS.sol';
import {IWSYSGateway} from './interfaces/IWSYSGateway.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {ReserveConfiguration} from '../protocol/libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../protocol/libraries/configuration/UserConfiguration.sol';
import {Helpers} from '../protocol/libraries/helpers/Helpers.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';

contract WSYSGateway is IWSYSGateway, Ownable {
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;
  using UserConfiguration for DataTypes.UserConfigurationMap;

  IWSYS internal immutable WSYS;

  /**
   * @dev Sets the WSYS address and the LendingPoolAddressesProvider address. Infinite approves lending pool.
   * @param wsys Address of the Wrapped Syscoin contract
   **/
  constructor(address wsys) public {
    WSYS = IWSYS(wsys);
  }

  function authorizeLendingPool(address lendingPool) external onlyOwner {
    WSYS.approve(lendingPool, uint256(-1));
  }

  /**
   * @dev deposits WSYS into the reserve, using native SYS. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param lendingPool address of the targeted underlying lending pool
   * @param onBehalfOf address of the user who will receive the aTokens representing the deposit
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function depositSYS(
    address lendingPool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable override {
    WSYS.deposit{value: msg.value}();
    ILendingPool(lendingPool).deposit(address(WSYS), msg.value, onBehalfOf, referralCode);
  }

  /**
   * @dev withdraws the WSYS _reserves of msg.sender.
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount amount of aWSYS to withdraw and receive native SYS
   * @param to address of the user who will receive native SYS
   */
  function withdrawSYS(address lendingPool, uint256 amount, address to) external override {
    IAToken aWSYS = IAToken(ILendingPool(lendingPool).getReserveData(address(WSYS)).aTokenAddress);
    uint256 userBalance = aWSYS.balanceOf(msg.sender);
    uint256 amountToWithdraw = amount;

    // if amount is equal to uint(-1), the user wants to redeem everything
    if (amount == type(uint256).max) {
      amountToWithdraw = userBalance;
    }
    aWSYS.transferFrom(msg.sender, address(this), amountToWithdraw);
    ILendingPool(lendingPool).withdraw(address(WSYS), amountToWithdraw, address(this));
    WSYS.withdraw(amountToWithdraw);
    _safeTransferSYS(to, amountToWithdraw);
  }

  /**
   * @dev repays a borrow on the WSYS reserve, for the specified amount (or for the whole amount, if uint256(-1) is specified).
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount the amount to repay, or uint256(-1) if the user wants to repay everything
   * @param rateMode the rate mode to repay
   * @param onBehalfOf the address for which msg.sender is repaying
   */
  function repaySYS(
    address lendingPool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable override {
    (uint256 stableDebt, uint256 variableDebt) = Helpers.getUserCurrentDebtMemory(
      onBehalfOf,
      ILendingPool(lendingPool).getReserveData(address(WSYS))
    );

    uint256 paybackAmount = DataTypes.InterestRateMode(rateMode) ==
      DataTypes.InterestRateMode.STABLE
      ? stableDebt
      : variableDebt;

    if (amount < paybackAmount) {
      paybackAmount = amount;
    }
    require(msg.value >= paybackAmount, 'msg.value is less than repayment amount');
    WSYS.deposit{value: paybackAmount}();
    ILendingPool(lendingPool).repay(address(WSYS), msg.value, rateMode, onBehalfOf);

    // refund remaining dust sys
    if (msg.value > paybackAmount) _safeTransferSYS(msg.sender, msg.value - paybackAmount);
  }

  /**
   * @dev borrow WSYS, unwraps to SYS and send both the SYS and DebtTokens to msg.sender, via `approveDelegation` and onBehalf argument in `LendingPool.borrow`.
   * @param lendingPool address of the targeted underlying lending pool
   * @param amount the amount of SYS to borrow
   * @param interesRateMode the interest rate mode
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards
   */
  function borrowSYS(
    address lendingPool,
    uint256 amount,
    uint256 interesRateMode,
    uint16 referralCode
  ) external override {
    ILendingPool(lendingPool).borrow(
      address(WSYS),
      amount,
      interesRateMode,
      referralCode,
      msg.sender
    );
    WSYS.withdraw(amount);
    _safeTransferSYS(msg.sender, amount);
  }

  /**
   * @dev transfer SYS to an address, revert if it fails.
   * @param to recipient of the transfer
   * @param value the amount to send
   */
  function _safeTransferSYS(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, 'SYS_TRANSFER_FAILED');
  }

  /**
   * @dev transfer ERC20 from the utility contract, for ERC20 recovery in case of stuck tokens due
   * direct transfers to the contract address.
   * @param token token to transfer
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyTokenTransfer(address token, address to, uint256 amount) external onlyOwner {
    IERC20(token).transfer(to, amount);
  }

  /**
   * @dev transfer native Ether from the utility contract, for native Ether recovery in case of stuck Ether
   * due selfdestructs or transfer ether to pre-computated contract address before deployment.
   * @param to recipient of the transfer
   * @param amount amount to send
   */
  function emergencyEtherTransfer(address to, uint256 amount) external onlyOwner {
    _safeTransferSYS(to, amount);
  }

  /**
   * @dev Get WSYS address used by WSYSGateway
   */
  function getWSYSAddress() external view returns (address) {
    return address(WSYS);
  }

  /**
   * @dev Only WSYS contract is allowed to transfer SYS here. Prevent other addresses to send Ether to this contract.
   */
  receive() external payable {
    require(msg.sender == address(WSYS), 'Receive not allowed');
  }

  /**
   * @dev Revert fallback calls
   */
  fallback() external payable {
    revert('Fallback not allowed');
  }
}
