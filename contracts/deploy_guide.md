# Step-by-Step Guide to Deploying and Verifying Contracts

This guide provides instructions on how to deploy and verify the `FlipGame`, `RPSGameOnMorph`, and `RanmiGame` contracts on a test network like Morph Holesky.

---

### **Part 1: Prerequisites & Configuration**

Before you begin, you need to set up your environment.

**Step 1.1: Install Dependencies**
If you haven't already, navigate to the `contracts` directory and install the necessary packages.
```bash
cd contracts
npm install
```

**Step 1.2: Create a `.env` File**
For security, your private key and API keys should not be hardcoded. Create a file named `.env` in the `contracts/` directory.

Copy the following into your `.env` file and replace the placeholder values with your actual data:
```
# Your wallet's private key (e.g., from MetaMask)
PRIVATE_KEY="YOUR_WALLET_PRIVATE_KEY"

# The RPC URL for the network you are deploying to (e.g., Morph Holesky)
MORPH_HOLESKY_RPC_URL="https://rpc-holesky.morphl2.io"

# The API key for the block explorer of that network to enable verification
MORPHSCAN_API_KEY="YOUR_MORPHSCAN_API_KEY"
```
**IMPORTANT:** Never commit your `.env` file to Git. The `.gitignore` file should already list it.

**Step 1.3: Configure Hardhat**
Your `hardhat.config.js` file needs to be aware of the network and the verification service. Replace the contents of your `hardhat.config.js` with the following to correctly load the environment variables and set up the network:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24", // Ensure this matches the pragma in your contracts
  networks: {
    morph_holesky: {
      url: process.env.MORPH_HOLESKY_RPC_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    // Your API key for Morphscan
    // Obtain one at https://www.morphl2.io/developers/tools/morph-scan
    apiKey: process.env.MORPHSCAN_API_KEY,
    customChains: [
      {
        network: "morph_holesky",
        chainId: 2810,
        urls: {
          apiURL: "https://api-holesky.morphl2.io/api",
          browserURL: "https://holesky.morphl2.io/"
        }
      }
    ]
  },
};
```

---

### **Part 2: Deployment & Verification**

Now you are ready to deploy and verify each contract.

**Important Note:** The constructor for each of these contracts takes your wallet address as an argument. This address will be the owner and/or trusted relayer.

#### **A. FlipGame**

1.  **Deploy the contract:**
    ```bash
    npx hardhat run scripts/deployFlip.js --network morph_holesky
    ```
    After the script runs, it will print the deployed contract address. **Copy this address.**

2.  **Verify the contract:**
    Use the `verify` command. Paste the contract address you copied. For the constructor argument, provide your own public wallet address (the one whose private key is in your `.env` file).
    ```bash
    npx hardhat verify --network morph_holesky DEPLOYED_FLIPGAME_ADDRESS "YOUR_DEPLOYER_WALLET_ADDRESS"
    ```

#### **B. RPSGame (Rock, Paper, Scissors)**

1.  **Deploy the contract:**
    ```bash
    npx hardhat run scripts/deployRPS.js --network morph_holesky
    ```
    **Copy the deployed contract address** from the output.

2.  **Verify the contract:**
    ```bash
    npx hardhat verify --network morph_holesky DEPLOYED_RPSGAME_ADDRESS "YOUR_DEPLOYER_WALLET_ADDRESS"
    ```

#### **C. RanmiGame**

1.  **Deploy the contract:**
    ```bash
    npx hardhat run scripts/deployRanmi.js --network morph_holesky
    ```
    **Copy the deployed contract address** from the output.

2.  **Verify the contract:**
    ```bash
    npx hardhat verify --network morph_holesky DEPLOYED_RANMIGAME_ADDRESS "YOUR_DEPLOYER_WALLET_ADDRESS"
    ```

---
**Summary:** The process for each contract is the same:
1. Run the deployment script.
2. Copy the output address.
3. Run the `verify` task with the correct address and constructor arguments.

Happy Deploying!
