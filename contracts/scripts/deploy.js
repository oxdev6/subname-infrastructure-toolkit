const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const rootDomain = process.env.ROOT_DOMAIN || "project.eth";

  const Registrar = await ethers.getContractFactory("SubnameRegistrar");
  const registrar = await Registrar.deploy(rootDomain, deployer.address);
  await registrar.waitForDeployment();

  console.log("SubnameRegistrar deployed:", await registrar.getAddress());
  console.log("Root domain:", rootDomain);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
