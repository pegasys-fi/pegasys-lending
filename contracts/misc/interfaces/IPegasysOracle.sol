// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title IPegasysOracle interface
 * @notice Interface for the Pegasys oracle.
 **/

interface IPegasysOracle {
  function BASE_CURRENCY() external view returns (address); // if usd returns 0x0, if sys returns wsys address

  function BASE_CURRENCY_UNIT() external view returns (uint256);

  /***********
    @dev returns the asset price in SYS
     */
  function getAssetPrice(address asset) external view returns (uint256);

  /**
   * @notice Returns the address of the source for an asset address
   * @param asset The address of the asset
   * @return The address of the source
   */
  function getSourceOfAsset(address asset) external view returns (address);
}
