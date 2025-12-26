import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { ConfidentialGold, MinerNFT } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture(deployer: HardhatEthersSigner) {
  const goldFactory = await ethers.getContractFactory("ConfidentialGold", deployer);
  const gold = (await goldFactory.deploy()) as ConfidentialGold;
  const goldAddress = await gold.getAddress();

  const minerFactory = await ethers.getContractFactory("MinerNFT", deployer);
  const miner = (await minerFactory.deploy(goldAddress)) as MinerNFT;
  const minerAddress = await miner.getAddress();

  await (await gold.connect(deployer).setMinter(minerAddress)).wait();

  return { gold, goldAddress, miner, minerAddress };
}

describe("MinerNFT", function () {
  let signers: Signers;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
  });

  it("mints exactly one miner per address and assigns power 100-500", async function () {
    const { miner, minerAddress } = await deployFixture(signers.deployer);

    const tx = await miner.connect(signers.alice).mintMiner();
    await tx.wait();

    const tokenId = await miner.minerTokenId(signers.alice.address);
    expect(tokenId).to.not.eq(0);

    await expect(miner.connect(signers.alice).mintMiner()).to.be.revertedWithCustomError(miner, "AlreadyMinted");

    const encryptedPower = await miner.minerPower(tokenId);
    expect(encryptedPower).to.not.eq(ethers.ZeroHash);

    const power = await fhevm.userDecryptEuint(FhevmType.euint16, encryptedPower, minerAddress, signers.alice);
    expect(power).to.be.gte(100);
    expect(power).to.be.lte(500);
  });

  it("mints confidential gold equal to miner power once per 24 hours", async function () {
    const { miner, minerAddress, gold, goldAddress } = await deployFixture(signers.deployer);

    await (await miner.connect(signers.alice).mintMiner()).wait();
    const tokenId = await miner.minerTokenId(signers.alice.address);

    const encryptedPower = await miner.minerPower(tokenId);
    const power = await fhevm.userDecryptEuint(FhevmType.euint16, encryptedPower, minerAddress, signers.alice);

    await (await miner.connect(signers.alice).mine(tokenId)).wait();

    const encryptedBalance1 = await gold.confidentialBalanceOf(signers.alice.address);
    const balance1 = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalance1, goldAddress, signers.alice);
    expect(balance1).to.eq(BigInt(power));

    await expect(miner.connect(signers.alice).mine(tokenId)).to.be.revertedWithCustomError(miner, "CooldownNotElapsed");

    await time.increase(24 * 60 * 60);

    await (await miner.connect(signers.alice).mine(tokenId)).wait();
    const encryptedBalance2 = await gold.confidentialBalanceOf(signers.alice.address);
    const balance2 = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalance2, goldAddress, signers.alice);
    expect(balance2).to.eq(BigInt(power) * 2n);
  });

  it("allows transferring a miner and updates power permissions", async function () {
    const { miner, minerAddress } = await deployFixture(signers.deployer);

    await (await miner.connect(signers.alice).mintMiner()).wait();
    const tokenId = await miner.minerTokenId(signers.alice.address);

    const encryptedPower = await miner.minerPower(tokenId);
    const powerAlice = await fhevm.userDecryptEuint(FhevmType.euint16, encryptedPower, minerAddress, signers.alice);

    await (await miner.connect(signers.alice).transferFrom(signers.alice.address, signers.bob.address, tokenId)).wait();
    expect(await miner.minerTokenId(signers.alice.address)).to.eq(0);
    expect(await miner.minerTokenId(signers.bob.address)).to.eq(tokenId);

    const powerBob = await fhevm.userDecryptEuint(FhevmType.euint16, encryptedPower, minerAddress, signers.bob);
    expect(powerBob).to.eq(powerAlice);
  });
});

