// This script deploys the RanmiGame contract to the Morph Holesky network.
// Run this script with the Morph network configuration:
// npx hardhat run scripts/deployRanmi.js --network morph_holesky

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RanmiGame to Morph Holesky with the account:", deployer.address);

  const RanmiGame = await hre.ethers.getContractFactory("RanmiGame");
  // The constructor for RanmiGame takes one argument: the trusted relayer address.
  // We are using the deployer's address as the initial relayer.
  const ranmiGame = await RanmiGame.deploy(deployer.address);

  await ranmiGame.waitForDeployment();

  console.log("RanmiGame deployed to:", await ranmiGame.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
