# Participant-Selection
This is the repo for participant selection in P2P CDNs.


## Environment Requirements

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- Hardhat v2.19.4
- Ethers v6.9.0

## Contract Description

The project consists of several smart contracts that work together to implement the FD++ protocol:

- `Main.sol`: The core contract implementing the main FD++ protocol flow and logic
- `Utility.sol`: Helper contract providing utility functions
- `altbn128.sol`: Contract for elliptic curve operations
- `Provider.sol`: Contract managing provider-related functionalities
- `Deliverer.sol`: Contract handling deliverer operations
- `Consumer.sol`: Contract managing consumer interactions
- `Content.sol`: Contract for content management
- `Modify.sol`: Contract containing state modification logic

## Installation

```bash
npm install
```

## Test Scripts

The repository includes two comprehensive test scripts demonstrating different scenarios:

1. `P2PCDN_1.js`: Tests the normal operation flow of the P2PCDN system


2. `P2PCDN_2.js`: Tests the dispute handling mechanisms


Both scripts provide extensive logging and state verification at each step, helping developers understand the system's behavior in different scenarios.

## Running Tests

Basic test execution:
```bash
npx hardhat test test/P2PCDN_1.js
```

With gas reporting:
```bash
REPORT_GAS=true npx hardhat test
```

Using Hardhat's local network (recommended for quick testing):
```bash
npx hardhat node
npx hardhat test --network localhost
```

## Network Configuration

The test environment supports multiple networks. Modify `hardhat.config.js` to configure different networks:

```javascript
networks: {
  // Local Hardhat Network
  hardhat: {
    chainId: 31337
  },
  // Sepolia Testnet
  sepolia: {
    url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    accounts: [PRIVATE_KEY]
  },
  // Polygon Mumbai
  mumbai: {
    url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`,
    accounts: [PRIVATE_KEY]
  },
  // Forked Mainnet
  forked: {
    url: "http://localhost:8545",
    forking: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      blockNumber: 12345678
    }
  }
}
```

## Quick Start Guide

For the fastest testing experience, use Hardhat's built-in network:

1. Start local Hardhat network:
```bash
npx hardhat node
```

2. In a new terminal, run tests:
```bash
npx hardhat test --network localhost
```

This approach provides:
- Instant transaction confirmations
- No gas costs
- Full state inspection capabilities
- Detailed error messages
- Transaction traces



## Additional Notes

- Both test scripts provide complete contract testing but with different focuses
- Tests can be run against any EVM-compatible network
- Local Hardhat network is recommended for development and initial testing
