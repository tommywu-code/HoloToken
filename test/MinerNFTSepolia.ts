import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { ConfidentialGold, MinerNFT } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("MinerNFTSepolia", function () {
  let signers: Signers;
  let miner: MinerNFT;
  let gold: ConfidentialGold;
  let minerAddress: string;
  let goldAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    await fhevm.initializeCLIApi();

    try {
      const minerDeployment = await deployments.get("MinerNFT");
      const goldDeployment = await deployments.get("ConfidentialGold");

      minerAddress = minerDeployment.address;
      goldAddress = goldDeployment.address;

      miner = await ethers.getContractAt("MinerNFT", minerAddress);
      gold = await ethers.getContractAt("ConfidentialGold", goldAddress);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("mints once and mines when cooldown allows", async function () {
    this.timeout(4 * 60000);

    const user = signers.alice.address;

    let tokenId = await miner.minerTokenId(user);
    if (tokenId === 0n) {
      const tx = await miner.connect(signers.alice).mintMiner();
      await tx.wait();
      tokenId = await miner.minerTokenId(user);
    }
    expect(tokenId).to.not.eq(0n);

    const powerHandle = await miner.minerPower(tokenId);
    expect(powerHandle).to.not.eq(ethers.ZeroHash);

    const power = await fhevm.userDecryptEuint(FhevmType.euint16, powerHandle, minerAddress, signers.alice);
    expect(power).to.be.gte(100);
    expect(power).to.be.lte(500);

    const encryptedBalanceBefore = await gold.confidentialBalanceOf(user);
    const balanceBefore =
      encryptedBalanceBefore === ethers.ZeroHash
        ? 0n
        : BigInt(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalanceBefore, goldAddress, signers.alice));

    const canMine = await miner.canMine(tokenId);
    if (canMine) {
      const tx = await miner.connect(signers.alice).mine(tokenId);
      await tx.wait();

      const canMineAfter = await miner.canMine(tokenId);
      expect(canMineAfter).to.eq(false);

      const encryptedBalanceAfter = await gold.confidentialBalanceOf(user);
      expect(encryptedBalanceAfter).to.not.eq(ethers.ZeroHash);

      const balanceAfter = BigInt(
        await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBalanceAfter, goldAddress, signers.alice),
      );
      expect(balanceAfter - balanceBefore).to.eq(BigInt(power));

      const lastMinedAt = await miner.lastMinedAt(tokenId);
      const nextMineAt = await miner.nextMineAt(tokenId);
      expect(nextMineAt).to.eq(lastMinedAt + 86400n);
    } else {
      const lastMinedAt = await miner.lastMinedAt(tokenId);
      const nextMineAt = await miner.nextMineAt(tokenId);
      expect(lastMinedAt).to.not.eq(0n);
      expect(nextMineAt).to.eq(lastMinedAt + 86400n);
    }
  });
});

