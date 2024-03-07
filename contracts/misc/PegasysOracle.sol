// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {IPriceOracleGetter} from '../interfaces/IPriceOracleGetter.sol';
import {ISupraSValueFeed} from './interfaces/ISupraSValueFeed.sol';

/// @title PegasysOracle
/// @author Aave and Pegasys
/// @notice Proxy smart contract to get the price of an asset from a price source, with Supra Oracle Aggregator
///         smart contracts as primary option
/// - If the returned price by a Supra Oracle aggregator is <= 0, the call is forwarded to a fallbackOracle
/// - Owned by the Pegasys governance system, allowed to add sources for assets, replace them
///   and change the fallbackOracle
/// - Modified for Pegasys deployment by adding free-based asset prices.
contract PegasysOracle is IPriceOracleGetter, Ownable {
  event AssetSourceUpdated(address indexed asset, uint64 indexed oracleIndex);
  event FallbackOracleUpdated(address indexed fallbackOracle);

  mapping(address => uint64) private assetsSources;
  ISupraSValueFeed public oracle;

  IPriceOracleGetter private _fallbackOracle;
  address public immutable BASE_CURRENCY;
  uint256 public immutable BASE_CURRENCY_UNIT;

  /// @notice Constructor
  /// @param assets The addresses of the assets
  /// @param indexes The index of the source of each asset
  /// @param oracleAddress Supra Oracle Address
  /// @param fallbackOracle The address of the fallback oracle to use if the data of an
  ///        aggregator is not consistent
  /// @param baseCurrency The base currency used for the price quotes. If USD is used, base currency is 0x0
  /// @param baseCurrencyUnit The unit of the base currency
  constructor(
    address[] memory assets,
    uint64[] memory indexes,
    address oracleAddress,
    address fallbackOracle,
    address baseCurrency,
    uint256 baseCurrencyUnit
  ) public {
    _setFallbackOracle(fallbackOracle);
    _setAssetsSources(assets, indexes);
    BASE_CURRENCY = baseCurrency;
    BASE_CURRENCY_UNIT = baseCurrencyUnit;
    oracle = ISupraSValueFeed(oracleAddress);
  }

  // @notice External function called by the Pegasys governance to set or replace sources of assets
  // @param assets The addresses of the assets
  // @param sources The address of the source of each asset
  function setAssetsSources(
    address[] calldata assets,
    uint64[] calldata indexes
  ) external onlyOwner {
    _setAssetsSources(assets, indexes);
  }

  // @notice Sets the fallbackOracle
  // - Callable only by the Pegasys governance
  // @param fallbackOracle The address of the fallbackOracle
  function setFallbackOracle(address fallbackOracle) external onlyOwner {
    _setFallbackOracle(fallbackOracle);
  }

  /**
   * @notice Internal function to set the sources for each asset
   * @param assets The addresses of the assets
   * @param sources The address of the source of each asset
   */
  function _setAssetsSources(address[] memory assets, uint64[] memory sources) internal {
    require(assets.length == sources.length, 'INCONSISTENT_PARAMS_LENGTH');
    for (uint256 i = 0; i < assets.length; i++) {
      assetsSources[assets[i]] = sources[i];
      emit AssetSourceUpdated(assets[i], sources[i]);
    }
  }

  /**
   * @notice Internal function to set the fallback oracle
   * @param fallbackOracle The address of the fallback oracle
   */
  function _setFallbackOracle(address fallbackOracle) internal {
    _fallbackOracle = IPriceOracleGetter(fallbackOracle);
    emit FallbackOracleUpdated(fallbackOracle);
  }

  /// @notice Gets an asset price by address
  /// @param asset The asset address
  function getAssetPrice(address asset) public view override returns (uint256) {
    uint64 index = assetsSources[asset];

    if (asset == BASE_CURRENCY) {
      return BASE_CURRENCY_UNIT;
    } else {
      (, , , uint256 price) = oracle.getSvalue(index);
      if (price > 0) {
        return price;
      } else {
        return _fallbackOracle.getAssetPrice(asset);
      }
    }
  }

  // @notice Gets a list of prices from a list of assets addresses
  // @param assets The list of assets addresses
  function getAssetsPrices(address[] calldata assets) external view returns (uint256[] memory) {
    uint256[] memory prices = new uint256[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      prices[i] = getAssetPrice(assets[i]);
    }
    return prices;
  }

  // @notice Gets the address of the source for an asset address
  // @param asset The address of the asset
  // @return address The address of the source
  function getIndexOfAsset(address asset) external view returns (uint64) {
    return assetsSources[asset];
  }

  // @notice Gets the address of the fallback oracle
  // @return address The addres of the fallback oracle
  function getFallbackOracle() external view returns (address) {
    return address(_fallbackOracle);
  }
}
