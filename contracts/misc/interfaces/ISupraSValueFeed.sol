// SPDX-License-Identifier: UNLICENSE
pragma solidity 0.6.12;

interface ISupraSValueFeed {
  function getSvalue(uint64 _pairIndex) external view returns (uint256, uint256, uint256, uint256);
}
