// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface IWSYSGateway {
  function depositSYS(
    address lendingPool,
    address onBehalfOf,
    uint16 referralCode
  ) external payable;

  function withdrawSYS(address lendingPool, uint256 amount, address onBehalfOf) external;

  function repaySYS(
    address lendingPool,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external payable;

  function borrowSYS(
    address lendingPool,
    uint256 amount,
    uint256 interesRateMode,
    uint16 referralCode
  ) external;
}
