require("dotenv").config();
require("@nomicfoundation/hardhat-verify");
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    morph_holesky: {
      url: "https://rpc-quicknode-holesky.morphl2.io",
      chainId: 2810,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    base_sepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      morph_holesky: "ANY_STRING", // Morphscan does not require an API key
      base_sepolia: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "morph_holesky",
        chainId: 2810,
        urls: {
          apiURL: "https://explorer-api-holesky.morphl2.io/api",
          browserURL: "https://explorer-holesky.morphl2.io",
        },
      },
      {
        network: "base_sepolia",
        chainId: 84532,
        urls: {
            apiURL: "https://api-sepolia.basescan.org/api",
            browserURL: "https://sepolia.basescan.org"
        }
      }
    ],
  },
  sourcify: {
    enabled: true,
  },
};
