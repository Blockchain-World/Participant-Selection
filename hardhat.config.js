require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.29",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "shanghai",
      viaIR: true
    }
  },
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
      accounts: ["YOUR_PRIVATE_KEY"],
      chainId: 11155111,
      blockConfirmations: 6,
      gas: 2100000,
      gasPrice: 8000000000, // 8 gwei
    },
    hardhat: {
      chainId: 31337,
    }
  },
  paths: {
    tests: "./test",
  },
  mocha: {
    timeout: 40000,
  },

  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 20,
    showMethodSig: true,
    showTimeSpent: true,
    src: "./contracts",
    outputFile: "gas-report.txt"
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
