'use strict';

const { LocalChain } = require('../lib/chain.js');
const { Storage } = require('../lib/storage.js');
const { loadKeys } = require('../lib/keys.js');
const { Token } = require('../smart-contracts/token.js');
const { BondingCurve } = require('../smart-contracts/bonding-curve.js');

/**
 * Example: Bonding Curve Implementation
 *
 * Demonstrates:
 * 1. Creating a token with bonding curve pricing
 * 2. Buying tokens (price increases as supply increases)
 * 3. Selling tokens (price decreases as supply decreases)
 * 4. Price discovery through the curve
 */

const main = async () => {
  console.log('🚀 Initializing Bonding Curve System...\n');

  // Initialize storage
  const keys = await loadKeys('./keys');
  const chain = await new LocalChain('./localchain');
  const storage = await new Storage('./storage', chain, keys);

  // Create token
  const token = new Token('Bonding Curve Token', 'BCT', { storage, chain });
  await token.initialize();
  console.log('✅ Token initialized\n');

  // Create bonding curve with linear pricing
  const bondingCurve = new BondingCurve(token, {
    curveType: 'linear',
    k: 0.001, // Price constant: price = 0.001 * supply
  });
  await bondingCurve.initialize();
  console.log('✅ Bonding curve initialized');
  console.log(`   Curve type: ${bondingCurve.getCurveInfo().curveType}`);
  console.log(`   Price constant (k): ${bondingCurve.getCurveInfo().k}\n`);

  // Addresses
  const alice = '0xAlice123';
  const bob = '0xBob456';

  // Initial state
  console.log('📊 Initial State:');
  const initialSupply = await bondingCurve.getSupply();
  const initialPrice = await bondingCurve.getCurrentPrice();
  console.log(`Supply: ${initialSupply} tokens`);
  console.log(`Current price: ${initialPrice.toFixed(6)} per token\n`);

  // Scenario 1: Alice buys tokens with 10 units of payment
  console.log('💵 Scenario 1: Alice buys tokens (pays 10 units)');
  const buy1 = await bondingCurve.buy(alice, 10);
  console.log(`   ✅ Bought ${buy1.tokenAmount.toFixed(4)} tokens`);
  console.log(`   Paid: ${buy1.paymentAmount.toFixed(4)} units`);
  console.log(`   Average price: ${buy1.price.toFixed(6)} per token`);
  console.log(`   New supply: ${buy1.newSupply.toFixed(4)} tokens`);
  console.log(`   Alice balance: ${buy1.buyerBalance.toFixed(4)} tokens\n`);

  // Check new price
  const priceAfterBuy1 = await bondingCurve.getCurrentPrice();
  console.log(
    `   New price after buy: ${priceAfterBuy1.toFixed(6)} per token\n`,
  );

  // Scenario 2: Bob buys tokens with 5 units of payment
  console.log('💵 Scenario 2: Bob buys tokens (pays 5 units)');
  const buy2 = await bondingCurve.buy(bob, 5);
  console.log(`   ✅ Bought ${buy2.tokenAmount.toFixed(4)} tokens`);
  console.log(`   Paid: ${buy2.paymentAmount.toFixed(4)} units`);
  console.log(`   Average price: ${buy2.price.toFixed(6)} per token`);
  console.log(`   New supply: ${buy2.newSupply.toFixed(4)} tokens`);
  console.log(`   Bob balance: ${buy2.buyerBalance.toFixed(4)} tokens\n`);

  // Check new price (should be higher)
  const priceAfterBuy2 = await bondingCurve.getCurrentPrice();
  console.log(`   New price after buy: ${priceAfterBuy2.toFixed(6)} per token`);
  console.log(
    `   Price increased by: ${(priceAfterBuy2 - priceAfterBuy1).toFixed(6)}\n`,
  );

  // Scenario 3: Alice sells some tokens
  console.log('💸 Scenario 3: Alice sells 100 tokens');
  const sell1 = await bondingCurve.sell(alice, 100);
  console.log(`   ✅ Sold ${sell1.tokenAmount.toFixed(4)} tokens`);
  console.log(`   Received: ${sell1.paymentAmount.toFixed(4)} units`);
  console.log(`   Average price: ${sell1.price.toFixed(6)} per token`);
  console.log(`   New supply: ${sell1.newSupply.toFixed(4)} tokens`);
  console.log(`   Alice balance: ${sell1.sellerBalance.toFixed(4)} tokens\n`);

  // Check new price (should be lower)
  const priceAfterSell = await bondingCurve.getCurrentPrice();
  console.log(
    `   New price after sell: ${priceAfterSell.toFixed(6)} per token`,
  );
  console.log(
    `   Price decreased by: ${(priceAfterBuy2 - priceAfterSell).toFixed(6)}\n`,
  );

  // Final state
  console.log('📊 Final State:');
  const finalSupply = await bondingCurve.getSupply();
  const finalPrice = await bondingCurve.getCurrentPrice();
  const paymentReserve = await bondingCurve.getPaymentReserve();
  console.log(`Supply: ${finalSupply.toFixed(4)} tokens`);
  console.log(`Current price: ${finalPrice.toFixed(6)} per token`);
  console.log(`Payment reserve: ${paymentReserve.toFixed(4)} units`);
  console.log(`Alice balance: ${await token.getBalance(alice)} tokens`);
  console.log(`Bob balance: ${await token.getBalance(bob)} tokens\n`);

  // Validate chain integrity
  const isValid = await chain.isValid();
  console.log(`🕵️  Blockchain valid: ${isValid}`);

  // Show price curve example
  console.log('\n📈 Price Curve Example (next 5 purchases of 1 unit each):');
  let currentSupply = finalSupply;
  for (let i = 0; i < 5; i++) {
    const price = bondingCurve.calculatePrice(currentSupply);
    const nextPrice = bondingCurve.calculatePrice(currentSupply + 1);
    console.log(
      `   Supply ${currentSupply.toFixed(2)}: price ${price.toFixed(6)} → ${nextPrice.toFixed(6)} (+${(nextPrice - price).toFixed(6)})`,
    );
    currentSupply += 1;
  }
};

main().catch(console.error);
