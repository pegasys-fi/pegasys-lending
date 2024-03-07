// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

interface GenericOracleI {
  // ganache
  event AssetPriceUpdated(address _asset, uint256 _price, uint256 timestamp);
  event SysPriceUpdated(uint256 _price, uint256 timestamp);

  // kovan
  event ProphecySubmitted(
    address indexed _sybil,
    address indexed _asset,
    uint96 _sybilProphecy,
    uint96 _oracleProphecy
  );

  function getAssetPrice(address _asset) external view returns (uint256);

  function getSysUsdPrice() external view returns (uint256);
}
