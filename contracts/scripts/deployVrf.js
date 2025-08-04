// This script deploys the VrfRequester contract to the Base Sepolia network.
// This contract gets random numbers from Chainlink VRF.
// Run this script with the Base Sepolia network configuration:
// npx hardhat run scripts/deployVrf.js --network base_sepolia

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying VrfRequester to Base Sepolia with the account:", deployer.address);

  const { VRF_COORDINATOR, KEY_HASH, SUB_ID } = process.env;
  if (!VRF_COORDINATOR || !KEY_HASH || !SUB_ID) {
    throw new Error("Please set VRF_COORDINATOR, KEY_HASH, and SUB_ID in your .env file");
  }

    const VrfRequester = await hre.ethers.getContractFactory("contracts/vrf.sol:VrfRequester");

  // The constructor for VrfRequester takes four arguments:
  // 1. address vrfCoordinator: The address of the Chainlink VRF Coordinator on Base Sepolia.
  // 2. bytes32 _keyHash: The gas lane key hash for Base Sepolia.
  // 3. uint256 _subId: The subscription ID for Chainlink VRF.
  // 4. address _initialOwner: The owner of the contract.
  const vrfRequester = await VrfRequester.deploy(
    VRF_COORDINATOR,
    KEY_HASH,
    SUB_ID,
    "0x52c043C7120d7DA35fFdDF6C5c2359d503ceE5F8"
  );

  await vrfRequester.waitForDeployment();

  console.log("VrfRequester deployed to:", await vrfRequester.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
