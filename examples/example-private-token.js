'use strict';

const { LocalChain } = require('../lib/chain.js');
const { Storage } = require('../lib/storage.js');
const { loadKeys } = require('../lib/keys.js');
const { PrivateToken } = require('../smart-contracts/private-token.js');

/**
 * Example: Private USDC Token System
 *
 * Demonstrates:
 * 1. Creating private USDC tokens with encrypted storage
 * 2. Minting tokens (balances stored encrypted)
 * 3. Transferring tokens (all data encrypted)
 * 4. Burning tokens
 * 5. Checking balances (automatically decrypted)
 */

const main = async () => {
  console.log('🔐 Initializing Private USDC System...\n');

  // Initialize storage with keys (required for encryption)
  const keys = await loadKeys('./keys');
  const chain = await new LocalChain('./localchain');
  const storage = await new Storage('./storage', chain, keys);

  // Create private token
  const usdc = new PrivateToken({ storage, chain });
  await usdc.initialize();
  console.log('✅ Private USDC initialized');
  console.log('   All balances stored with encryption\n');

  // Addresses
  const bridgeAddress = '0xBridge123';
  const alice = '0xAlice456';
  const bob = '0xBob789';

  console.log('📊 Initial State:');
  console.log(`Bridge: ${await usdc.getBalance(bridgeAddress)} USDC`);
  console.log(`Alice: ${await usdc.getBalance(alice)} USDC`);
  console.log(`Bob: ${await usdc.getBalance(bob)} USDC\n`);

  // Scenario 1: Alice deposits USDC on main chain, bridge mints private USDC
  console.log('💵 Scenario 1: Alice deposits 1000 USDC on Ethereum');
  console.log('   → Bridge mints 1000 private USDC to Alice (encrypted)');
  const mintResult = await usdc.mint(alice, 1000, '0xEthereumTxHash123...');
  console.log(`   ✅ Minted`);
  console.log(`   Alice balance: ${await usdc.getBalance(alice)} USDC\n`);

  // Scenario 2: Alice transfers private USDC to Bob
  console.log('💸 Scenario 2: Alice transfers 250 private USDC to Bob');
  const transferResult = await usdc.transfer(alice, bob, 250);
  console.log(`   ✅ Transferred`);
  console.log(`   Alice balance: ${transferResult.fromBalance} USDC`);
  console.log(`   Bob balance: ${transferResult.toBalance} USDC\n`);

  // Scenario 3: Bob transfers private USDC back to Alice
  console.log('💸 Scenario 3: Bob transfers 100 private USDC to Alice');
  const transfer2Result = await usdc.transfer(bob, alice, 100);
  console.log(`   ✅ Transferred`);
  console.log(`   Bob balance: ${transfer2Result.fromBalance} USDC`);
  console.log(`   Alice balance: ${transfer2Result.toBalance} USDC\n`);

  // Scenario 4: Alice withdraws private USDC (burns tokens)
  console.log('🔥 Scenario 4: Alice withdraws 500 private USDC');
  console.log(
    '   → Bridge burns 500 private USDC, releases 500 USDC on Ethereum',
  );
  const burnResult = await usdc.burn(
    alice,
    500,
    '0xEthereumWithdrawAddress...',
  );
  console.log(`   ✅ Burned`);
  console.log(`   Alice balance: ${burnResult.balance} USDC\n`);

  // Final balances
  console.log('📊 Final State:');
  console.log(`Bridge: ${await usdc.getBalance(bridgeAddress)} USDC`);
  console.log(`Alice: ${await usdc.getBalance(alice)} USDC`);
  console.log(`Bob: ${await usdc.getBalance(bob)} USDC\n`);

  // Validate chain integrity
  const isValid = await chain.isValid();
  console.log(`🕵️  Blockchain valid: ${isValid}`);

  console.log('\n🔐 Security Note:');
  console.log(
    '   - All balances are stored encrypted using built-in encryption',
  );
  console.log('   - Only users with private keys can decrypt balances');
  console.log('   - No transaction logs on blockchain for privacy');
};

main().catch(console.error);
