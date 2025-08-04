// This script deploys the FlipGame contract to the Morph Holesky network.
// Run this script with the Morph network configuration:
// npx hardhat run scripts/deployFlip.js --network morph_holesky

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying FlipGame to Morph Holesky with the account:", deployer.address);

  const FlipGame = await hre.ethers.getContractFactory("FlipGame");
  // The constructor for FlipGame takes one argument: the initial owner address.
  // This will also be the initial trustedRelayer.
  const flipGame = await FlipGame.deploy("0x52c043C7120d7DA35fFdDF6C5c2359d503ceE5F8");

  await flipGame.waitForDeployment();

  console.log("FlipGame deployed to:", await flipGame.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});