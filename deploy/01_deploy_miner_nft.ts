import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deployments, ethers } = hre;
  const { deploy, get } = deployments;

  const gold = await get("ConfidentialGold");

  const deployedMiner = await deploy("MinerNFT", {
    from: deployer,
    args: [gold.address],
    log: true,
  });

  const signer = await ethers.getSigner(deployer);
  const goldContract = await ethers.getContractAt("ConfidentialGold", gold.address, signer);

  const currentMinter = await goldContract.minter();
  if (currentMinter.toLowerCase() !== deployedMiner.address.toLowerCase()) {
    const tx = await goldContract.setMinter(deployedMiner.address);
    await tx.wait();
  }

  console.log(`MinerNFT contract: ${deployedMiner.address}`);
};

export default func;
func.id = "deploy_miner_nft";
func.tags = ["MinerNFT", "HoloToken"];
func.dependencies = ["deploy_confidential_gold"];

