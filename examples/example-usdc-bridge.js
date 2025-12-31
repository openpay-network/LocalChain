'use strict';


const { Token, loadKeys, Storage, LocalChain } = require('openpay-network');

  const keys = await loadKeys('./keys');
  const chain = await new LocalChain('./localchain');
  const storage = await new Storage('./storage', chain, keys);

  const sync = await new SyncMode({
    network: 'solana',
    chain,
    storage,
    connection,
    interval: '60',
  });

  sync.start()
  // Create bridge USDC token
  const usdc = new Token('Bridge USDC', 'bUSDC', { storage, chain });
  await usdc.initialize();
  console.log('✅ Bridge USDC token initialized\n');

  // Addresses
  const bridgeAddress = '0xBridge123';
  const alice = '0xAlice456';
  const bob = '0xBob789';

  console.log('📊 Initial State:');
  console.log(`Bridge: ${await usdc.getBalance(bridgeAddress)} bUSDC`);
  console.log(`Alice: ${await usdc.getBalance(alice)} bUSDC`);
  console.log(`Bob: ${await usdc.getBalance(bob)} bUSDC\n`);

  // Scenario 1: Alice deposits 1000 USDC on main chain, bridge mints bUSDC
  console.log('💵 Scenario 1: Alice deposits 1000 USDC on Ethereum');
  console.log('   → Bridge mints 1000 bUSDC to Alice');
  const mintResult = await usdc.mint(
    alice,
    1000,
    '0xEthereumTxHash123...', // Reference to main chain transaction
  );
  console.log(`   ✅ Minted: ${mintResult.txId}`);
  console.log(`   Alice balance: ${await usdc.getBalance(alice)} bUSDC\n`);

  // Scenario 2: Alice transfers 250 bUSDC to Bob
  console.log('💸 Scenario 2: Alice transfers 250 bUSDC to Bob');
  const transferResult = await usdc.transfer(alice, bob, 250);
  console.log(`   ✅ Transfer: ${transferResult.txId}`);
  console.log(`   Alice balance: ${transferResult.fromBalance} bUSDC`);
  console.log(`   Bob balance: ${transferResult.toBalance} bUSDC\n`);

  // Scenario 3: Bob transfers 100 bUSDC back to Alice
  console.log('💸 Scenario 3: Bob transfers 100 bUSDC to Alice');
  const transfer2Result = await usdc.transfer(bob, alice, 100);
  console.log(`   ✅ Transfer: ${transfer2Result.txId}`);
  console.log(`   Bob balance: ${transfer2Result.fromBalance} bUSDC`);
  console.log(`   Alice balance: ${transfer2Result.toBalance} bUSDC\n`);

  // Scenario 4: Alice withdraws 500 bUSDC (burns tokens)
  console.log('🔥 Scenario 4: Alice withdraws 500 bUSDC');
  console.log('   → Bridge burns 500 bUSDC, releases 500 USDC on Ethereum');
  const burnResult = await usdc.burn(
    alice,
    500,
    '0xEthereumWithdrawAddress...',
  );
  console.log(`   ✅ Burned: ${burnResult.txId}`);
  console.log(`   Alice balance: ${burnResult.balance} bUSDC\n`);

  // Final balances
  console.log('📊 Final State:');
  console.log(`Bridge: ${await usdc.getBalance(bridgeAddress)} bUSDC`);
  console.log(`Alice: ${await usdc.getBalance(alice)} bUSDC`);
  console.log(`Bob: ${await usdc.getBalance(bob)} bUSDC\n`);

  // Validate chain integrity
  const isValid = await chain.isValid();
  console.log(`🕵️  Blockchain valid: ${isValid}`);

  // Show transaction history
  console.log('\n📜 Transaction History:');
  let currentHash = chain.tailHash;
  let count = 0;
  while (currentHash && count < 10) {
    try {
      const block = await chain.readBlock(currentHash);
      if (
        block.data.type === 'token-transfer' ||
        block.data.type === 'token-mint' ||
        block.data.type === 'token-burn'
      ) {
        console.log(
          `   ${block.data.type}: ${JSON.stringify({
            txId: block.data.txId,
            amount: block.data.amount,
            timestamp: new Date(block.data.timestamp).toISOString(),
          })}`,
        );
      }
      if (block.prev === '0') break;
      currentHash = block.prev;
      count++;
    } catch (e) {
      break;
    }
  }
};

main().catch(console.error);
