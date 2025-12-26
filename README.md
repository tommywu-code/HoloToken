# HoloToken

HoloToken is a privacy-first on-chain mining game built on Zama FHEVM. Each wallet can mint a single Miner NFT that holds an
encrypted power value (100 to 500). Once every 24 hours, the Miner can mine Confidential Gold equal to its hidden power. The
entire flow is enforced on-chain, while power and balances stay encrypted.

## Project Summary

- A minimal mining loop with real on-chain randomness and encrypted rewards.
- Miner power is generated on-chain as encrypted data and never revealed unless the owner decrypts it.
- Gold balances are confidential and can be decrypted by the owner through the Zama relayer.
- One Miner per wallet is enforced to keep the economy simple and fair.

## Problems Solved

- Prevents public trait sniping and targeted strategies by keeping Miner power private.
- Avoids visible balances and farm detection by storing Gold as encrypted balances.
- Removes off-chain trust for randomness and reward calculation by performing them on-chain in FHE.
- Provides a predictable, enforceable mining cadence (24 hours) without centralized timers.

## Advantages

- True on-chain randomness under FHE, not a server-side RNG.
- Encrypted gameplay stats and balances reduce information asymmetry.
- Simple, auditable contract surface area with strict mint and cooldown rules.
- No off-chain database or game server is required.
- Frontend supports self-service decryption without storing secrets on-chain.

## Core Gameplay

1. Mint exactly one Miner NFT per wallet.
2. The Miner receives a random encrypted power between 100 and 500.
3. Once per 24 hours, mine Confidential Gold equal to the Miner power.
4. Decrypt Miner power and Gold balance using the Zama relayer.

## Architecture Overview

### MinerNFT (ERC721)

- Mints one Miner per wallet and blocks additional mints permanently.
- Generates encrypted power with `FHE.randEuint16` and bounds it to 100 to 500.
- Enforces a 24 hour cooldown per token.
- Calls the Gold contract to mint encrypted Gold after each mine.
- Keeps the encrypted power value accessible only to the owner.

### ConfidentialGold (ERC7984)

- Confidential token with encrypted balances.
- Only the MinerNFT contract can mint.
- Supports owner-only decryption via the relayer.

### Zama Relayer

- Handles user decryption requests for encrypted handles (power, balance).
- Requires wallet signature and ephemeral keypairs.

## Tech Stack

### Smart Contracts

- Solidity 0.8.27
- Hardhat + hardhat-deploy
- Zama FHEVM libraries
- OpenZeppelin ERC721 + ERC7984 (confidential token)

### Frontend

- React + Vite
- wagmi + viem for reads
- ethers for writes
- RainbowKit wallet UI
- Zama relayer SDK for decryption

## Project Structure

```
contracts/                 MinerNFT and ConfidentialGold contracts
deploy/                    Deployment scripts
tasks/                     Mining and frontend sync tasks
test/                      Contract tests
home/                      React frontend (Vite)
docs/                      Zama references
```

## Setup Requirements

- Node.js 20+
- npm
- Sepolia RPC access (INFURA API key)
- EOA private key for deployment (no mnemonic)

Create a `.env` file in the repo root with:

```
INFURA_API_KEY=...
PRIVATE_KEY=...
ETHERSCAN_API_KEY=...  # optional, for verification
```

## Contract Workflow

### Install and Compile

```bash
npm install
npm run compile
```

### Run Tests

```bash
npm run test
```

### Deploy Locally

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

### Sync Frontend ABIs and Addresses

The frontend does not use JSON configuration. It consumes a generated TypeScript file built from
`deployments/sepolia`:

```bash
npx hardhat task:sync-frontend --network sepolia
```

This generates `home/src/config/contracts.ts` with the contract addresses and ABI.

## Useful Tasks

```bash
# Print contract addresses
npx hardhat task:miner:address --network sepolia

# Mint a Miner NFT
npx hardhat task:miner:mint --network sepolia

# Mine Gold (use your token id)
npx hardhat task:miner:mine --tokenid <TOKEN_ID> --network sepolia

# Decrypt miner power
npx hardhat task:miner:decrypt-power --tokenid <TOKEN_ID> --network sepolia

# Decrypt gold balance for the signer
npx hardhat task:gold:decrypt-balance --network sepolia
```

## Frontend Workflow

```bash
cd home
npm install
npm run dev
```

- Connect your wallet on Sepolia.
- Mint a Miner NFT.
- Mine once every 24 hours.
- Decrypt power and balances via the relayer UI.

## Future Roadmap

- Miner upgrade path with optional encrypted upgrades.
- Additional resources and crafting loops that stay confidential.
- Multi-chain deployment once FHEVM networks are available.
- Optional reveal mechanics for competitive leaderboards.
- Gas optimization and batch mining flows.

## License

BSD-3-Clause-Clear. See `LICENSE`.
