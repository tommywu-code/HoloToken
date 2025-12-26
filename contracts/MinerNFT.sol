// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint16, euint64} from "@fhevm/solidity/lib/FHE.sol";

import {ConfidentialGold} from "./ConfidentialGold.sol";

contract MinerNFT is ERC721, Ownable, ZamaEthereumConfig {
    uint256 public constant MINING_COOLDOWN = 1 days;

    ConfidentialGold public immutable gold;

    uint256 private _nextTokenId = 1;
    mapping(address owner => bool minted) private _mintedOnce;
    mapping(address owner => uint256 tokenId) private _minerTokenId;

    mapping(uint256 tokenId => euint16 power) private _powerByTokenId;
    mapping(uint256 tokenId => uint256 lastMinedAt) private _lastMinedAt;

    error AlreadyMinted(address owner);
    error RecipientAlreadyHasMiner(address recipient);
    error NotTokenOwner(address caller, uint256 tokenId);
    error CooldownNotElapsed(uint256 tokenId, uint256 nextMineAt);

    event MinerMinted(address indexed owner, uint256 indexed tokenId, euint16 power);
    event Mined(address indexed owner, uint256 indexed tokenId, euint64 goldAmount);

    constructor(address goldToken) ERC721("Holo Miner", "MINER") Ownable(msg.sender) {
        gold = ConfidentialGold(goldToken);
    }

    function minerTokenId(address owner) external view returns (uint256) {
        return _minerTokenId[owner];
    }

    function minerPower(uint256 tokenId) external view returns (euint16) {
        return _powerByTokenId[tokenId];
    }

    function lastMinedAt(uint256 tokenId) external view returns (uint256) {
        return _lastMinedAt[tokenId];
    }

    function nextMineAt(uint256 tokenId) public view returns (uint256) {
        uint256 last = _lastMinedAt[tokenId];
        if (last == 0) return 0;
        return last + MINING_COOLDOWN;
    }

    function canMine(uint256 tokenId) external view returns (bool) {
        uint256 nextAt = nextMineAt(tokenId);
        return nextAt == 0 || block.timestamp >= nextAt;
    }

    function mintMiner() external returns (uint256 tokenId) {
        if (_mintedOnce[msg.sender]) revert AlreadyMinted(msg.sender);
        if (balanceOf(msg.sender) != 0) revert RecipientAlreadyHasMiner(msg.sender);

        tokenId = _nextTokenId++;
        _mintedOnce[msg.sender] = true;
        _minerTokenId[msg.sender] = tokenId;

        _safeMint(msg.sender, tokenId);

        euint16 random = FHE.rem(FHE.randEuint16(), 401);
        euint16 power = FHE.add(random, uint16(100));

        _powerByTokenId[tokenId] = power;
        FHE.allowThis(power);
        FHE.allow(power, msg.sender);

        emit MinerMinted(msg.sender, tokenId, power);
    }

    function mine(uint256 tokenId) external returns (euint64 goldAmount) {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner(msg.sender, tokenId);

        uint256 nextAt = nextMineAt(tokenId);
        if (nextAt != 0 && block.timestamp < nextAt) revert CooldownNotElapsed(tokenId, nextAt);

        _lastMinedAt[tokenId] = block.timestamp;

        euint16 power = _powerByTokenId[tokenId];
        goldAmount = FHE.asEuint64(power);
        FHE.allow(goldAmount, address(gold));

        euint64 transferred = gold.mintEncrypted(msg.sender, goldAmount);
        FHE.allowTransient(transferred, msg.sender);

        emit Mined(msg.sender, tokenId, transferred);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && balanceOf(to) != 0) {
            revert RecipientAlreadyHasMiner(to);
        }

        from = super._update(to, tokenId, auth);

        if (from != address(0)) _minerTokenId[from] = 0;
        if (to != address(0)) _minerTokenId[to] = tokenId;

        if (to != address(0)) {
            euint16 power = _powerByTokenId[tokenId];
            if (FHE.isInitialized(power)) FHE.allow(power, to);
        }
    }
}
