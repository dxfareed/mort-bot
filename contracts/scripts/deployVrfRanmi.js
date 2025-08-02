// This script deploys the Ranmi-specific VrfRequester contract to the Base Sepolia network.
// This contract gets random numbers from Chainlink VRF for the RanmiGame.
// Run this script with the Base Sepolia network configuration:
// npx hardhat run scripts/deployVrfRanmi.js --network base_sepolia

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying Ranmi VrfRequester to Base Sepolia with account:", deployer.address);

  const { VRF_COORDINATOR, KEY_HASH, SUB_ID } = process.env;
  if (!VRF_COORDINATOR || !KEY_HASH || !SUB_ID) {
    throw new Error("Please set VRF_COORDINATOR, KEY_HASH, and SUB_ID in your .env file");
  }

  // We use the fully qualified name to avoid ambiguity with the other VrfRequester contract
  const VrfRequester = await hre.ethers.getContractFactory("contracts/ranmi/vrf-ranmi.sol:VrfRequester");

  // The constructor for this VrfRequester takes four arguments:
  // 1. address vrfCoordinator: The address of the Chainlink VRF Coordinator on Base Sepolia.
  // 2. bytes32 _keyHash: The gas lane key hash for Base Sepolia.
  // 3. uint256 _subId: The subscription ID for Chainlink VRF.
  // 4. address _admin: The admin of the contract.
  const vrfRequester = await VrfRequester.deploy(
    VRF_COORDINATOR,
    KEY_HASH,
    SUB_ID,
    deployer.address
  );

  await vrfRequester.waitForDeployment();

  console.log("Ranmi VrfRequester deployed to:", await vrfRequester.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
