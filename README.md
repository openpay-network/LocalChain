# LocalChain

**LocalChain** is a JavaScript-first local private chain for Agentic Storage and State Management with Smart Contracts. It provides a tamper-proof, blockchain-backed storage system with built-in encryption, smart contracts, and token economics.

## Features

- 🔗 **Local Blockchain** - Tamper-proof operation history with cryptographic integrity
- 💾 **Encrypted Storage** - Optional RSA encryption for sensitive data
- 📜 **JavaScript Smart Contracts** - Write contracts in plain JavaScript
- 🪙 **Token System** - Built-in token support with mint, burn, and transfer
- 📈 **Bonding Curves** - Automated price discovery for token economics
- 🔐 **Cryptographic Security** - RSA-2048 encryption and SHA-256 hashing
- ✅ **Data Validation** - Automatic integrity verification on read
- 🚀 **Zero Dependencies** - Uses only Node.js built-ins and minimal utilities

## Quick Start

```javascript
const { LocalChain, Storage, loadKeys, SmartContract } = require('./main');

// Initialize
const keys = await loadKeys('./keys');
const chain = await new LocalChain('./localchain');
const storage = await new Storage('./storage', chain, keys);

// Save data
await storage.saveData('user-123', { name: 'Alice', balance: 100 });

// Load data
const user = await storage.loadData('user-123');

// Create a smart contract
const contractProc = async (reader, args) => {
  const data = await reader.get(args.id);
  return { ...data, updated: Date.now() };
};

const contract = new SmartContract('update-contract', contractProc, {
  storage,
  chain,
});

// Execute contract
const result = await contract.execute({ id: 'user-123' });
```

## Core Concepts

### LocalChain

A local blockchain that maintains an immutable, tamper-proof log of all operations.

```javascript
const { LocalChain } = require('./main');

const chain = await new LocalChain('./localchain');

// Add a block
const { id, hash } = await chain.addBlock({
  type: 'transaction',
  from: 'alice',
  to: 'bob',
  amount: 100,
});

// Validate chain integrity
const isValid = await chain.isValid();

// Read a block
const block = await chain.readBlock(hash);
```

### Storage

Blockchain-backed storage with optional encryption and automatic integrity validation.

```javascript
const { Storage, LocalChain, loadKeys } = require('./main');

const keys = await loadKeys('./keys');
const chain = await new LocalChain('./localchain');
const storage = await new Storage('./storage', chain, keys);

// Save plain data
await storage.saveData('record-1', { value: 42 });

// Save encrypted data
await storage.saveData('secret-1', { password: 'secret' }, { encrypted: true });

// Load data (automatically decrypted if needed)
const data = await storage.loadData('record-1');

// Validate data integrity
const isValid = await storage.validate('record-1', data, blockHash);
```

### Smart Contracts

Write smart contracts in plain JavaScript. Contracts can read from storage and execute business logic.

```javascript
const { SmartContract, Storage, LocalChain } = require('./main');

const chain = await new LocalChain('./localchain');
const storage = await new Storage('./storage', chain);

// Define contract logic
const transferProc = async (reader, args) => {
  const { from, to, amount } = args;

  // Read balances
  const fromBalance = (await reader.get(`balance:${from}`)) || { balance: 0 };
  const toBalance = (await reader.get(`balance:${to}`)) || { balance: 0 };

  // Validate
  if (fromBalance.balance < amount) {
    throw new Error('Insufficient balance');
  }

  // Return new state
  return {
    from: { ...fromBalance, balance: fromBalance.balance - amount },
    to: { ...toBalance, balance: toBalance.balance + amount },
  };
};

// Create contract
const contract = new SmartContract('transfer', transferProc, {
  storage,
  chain,
});

// Execute
const result = await contract.execute({
  id: 'transfer-1',
  from: 'alice',
  to: 'bob',
  amount: 50,
});
```

### Token System

Built-in token support for creating digital assets with mint, burn, and transfer operations.

```javascript
const { Token } = require('./smart-contracts/token');
const { Storage, LocalChain } = require('./main');

const chain = await new LocalChain('./localchain');
const storage = await new Storage('./storage', chain);

// Create token
const token = new Token('My Token', 'MTK', { storage, chain });
await token.initialize();

// Mint tokens
await token.mint('0xAlice', 1000, '0xEthereumTxHash...');

// Transfer tokens
await token.transfer('0xAlice', '0xBob', 250);

// Burn tokens
await token.burn('0xAlice', 100, '0xWithdrawAddress...');

// Check balance
const balance = await token.getBalance('0xAlice');
```

### Bonding Curves

Automated price discovery mechanism for tokens using mathematical curves.

```javascript
const { BondingCurve } = require('./smart-contracts/bonding-curve');
const { Token } = require('./smart-contracts/token');

// Create token and bonding curve
const token = new Token('Curve Token', 'CTK', { storage, chain });
await token.initialize();

const bondingCurve = new BondingCurve(token, {
  curveType: 'linear', // or 'polynomial', 'exponential'
  k: 0.001, // price constant
});

await bondingCurve.initialize();

// Buy tokens (price increases)
const buyResult = await bondingCurve.buy('0xAlice', 10);
console.log(
  `Bought ${buyResult.tokenAmount} tokens at ${buyResult.price} each`,
);

// Sell tokens (price decreases)
const sellResult = await bondingCurve.sell('0xAlice', 100);
console.log(`Sold tokens, received ${sellResult.paymentAmount}`);

// Check current price
const price = await bondingCurve.getCurrentPrice();
```

## API Reference

### LocalChain

#### `new LocalChain(basePath)`

Create a new local chain instance.

#### `chain.addBlock(data)`

Add a new block to the chain. Returns `{ id, hash }`.

#### `chain.readBlock(hash)`

Read a block by its hash.

#### `chain.isValid({ last, from })`

Validate chain integrity. Optionally validate only the last N blocks or from a specific hash.

### Storage

#### `new Storage(basePath, blockchain, keys)`

Create a new storage instance.

#### `storage.saveData(id, data, options)`

Save data with optional encryption. Options: `{ encrypted: boolean }`.

#### `storage.loadData(id)`

Load data (automatically decrypted if encrypted).

#### `storage.validate(id, data, blockHash)`

Validate data integrity against blockchain.

### SmartContract

#### `new SmartContract(name, proc, { storage, chain })`

Create a new smart contract.

#### `contract.execute(args)`

Execute the contract with given arguments.

#### `SmartContract.save(name, chain, proc)`

Save a contract to the blockchain.

#### `SmartContract.load(hash, { storage, chain })`

Load a contract from the blockchain.

### Keys

#### `loadKeys(basePath)`

Load or generate RSA key pair.

#### `generateKeys()`

Generate a new RSA-2048 key pair.

#### `encrypt(data, publicKey)`

Encrypt data with a public key.

#### `decrypt(encryptedData, privateKey)`

Decrypt data with a private key.

## Use Cases

### AI Agents

- **State Management**: Persist agent state across sessions
- **Action History**: Tamper-proof audit trail of agent decisions
- **Smart Contracts**: Define agent behaviors as executable contracts
- **Encryption**: Secure sensitive agent data

### Token Economics

- **Bridge Tokens**: Create bridged versions of external tokens
- **Bonding Curves**: Automated price discovery for new tokens
- **DeFi Applications**: Build decentralized finance features

### Data Integrity

- **Audit Trails**: Immutable logs of all operations
- **Data Validation**: Automatic integrity checks
- **Version Control**: Track all changes to data

### Privacy-First Applications

- **Local-First**: All data stored locally
- **Encryption**: Optional end-to-end encryption
- **No Cloud Dependency**: Works completely offline

## Examples

See the `examples/` directory for complete working examples:

- `example-usdc-bridge.js` - Bridge token implementation
- `example-bonding-curve.js` - Bonding curve price discovery

## Architecture

```
┌─────────────┐
│ LocalChain  │ ← Blockchain integrity layer
└──────┬──────┘
       │
┌──────▼──────┐
│  Storage   │ ← Encrypted/plain storage
└──────┬──────┘
       │
┌──────▼──────────┐
│ Smart Contracts │ ← Business logic
└─────────────────┘
```

## Security

- **Cryptographic Hashing**: SHA-256 for block integrity
- **RSA Encryption**: 2048-bit keys for data encryption
- **Tamper Detection**: Automatic validation on read
- **Private Keys**: Never transmitted, stored locally only

## Roadmap

### 🔄 Solana Hash Sync Mode (Upcoming)

- Introduce a **hash sync mode** with **Solana** to enable external state anchoring and verification
- LocalChain state hashes will be periodically synced to Solana for additional integrity and interoperability
- **$OPN** will be used as the **payment token for state synchronization**, enabling:
  - Pay-per-sync economics
  - Spam resistance
  - Sustainable validator incentives
- Designed to remain **optional and non-custodial**, preserving LocalChain’s local-first and offline-capable philosophy

More details, specifications, and examples will be released as the feature approaches launch.

## Requirements

- Node.js 18+ (or 20, 21, 22, 23, 24)

## License

MIT

## Contributing

Contributions welcome! Please see the repository for guidelines.

## Repository

https://github.com/openpay-network/LocalChain

## Documentation

https://developers.openpay.network/LocalChain
