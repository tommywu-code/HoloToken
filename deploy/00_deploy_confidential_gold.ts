import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedGold = await deploy("ConfidentialGold", {
    from: deployer,
    log: true,
  });

  console.log(`ConfidentialGold contract: ${deployedGold.address}`);
};

export default func;
func.id = "deploy_confidential_gold";
func.tags = ["ConfidentialGold", "HoloToken"];

