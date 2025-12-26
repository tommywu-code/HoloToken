// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialGold is ERC7984, Ownable, ZamaEthereumConfig {
    address public minter;

    error UnauthorizedMinter(address caller);
    error InvalidMinter(address minter);

    constructor() ERC7984("Gold", "GOLD", "") Ownable(msg.sender) {}

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) revert InvalidMinter(newMinter);
        minter = newMinter;
    }

    function mintEncrypted(address to, euint64 amount) external returns (euint64 transferred) {
        if (msg.sender != minter) revert UnauthorizedMinter(msg.sender);
        transferred = _mint(to, amount);
        FHE.allowTransient(transferred, msg.sender);
    }
}
