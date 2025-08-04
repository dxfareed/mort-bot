// This script deploys the RPSGameOnMorph contract to the Morph Holesky network.
// Run this script with the Morph network configuration:
// npx hardhat run scripts/deployRPS.js --network morph_holesky

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RPSGameOnMorph to Morph Holesky with the account:", deployer.address);

  const RPSGame = await hre.ethers.getContractFactory("RPSGameOnMorph");
  // The constructor for RPSGameOnMorph takes one argument: the initial owner address.
  // This will also be the initial trustedRelayer.
  const rpsGame = await RPSGame.deploy("0x52c043C7120d7DA35fFdDF6C5c2359d503ceE5F8");

  await rpsGame.waitForDeployment();

  console.log("RPSGameOnMorph deployed to:", await rpsGame.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
