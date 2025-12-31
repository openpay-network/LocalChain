'use strict';

const { LocalChain } = require('../lib/chain.js');
const { Storage } = require('../lib/storage.js');
const { loadKeys } = require('../lib/keys.js');
const { WishList } = require('../smart-contracts/wishlist.js');

/**
 * Example: Wish List System
 *
 * Demonstrates:
 * 1. Adding items to wish list
 * 2. Reserving items by other users
 * 3. Updating item status
 * 4. Retrieving wish lists
 * 5. Tracking reservations
 */

const main = async () => {
  console.log('🎁 Initializing Wish List System...\n');

  // Initialize storage
  const keys = await loadKeys('./keys');
  const chain = await new LocalChain('./localchain');
  const storage = await new Storage('./storage', chain, keys);

  // Create wish list
  const wishList = new WishList({ storage, chain });
  await wishList.initialize();
  console.log('✅ Wish list initialized\n');

  const alice = 'user-alice';
  const bob = 'user-bob';
  const charlie = 'user-charlie';

  // Alice adds items to her wish list
  console.log('👤 Alice adds items to her wish list:');
  const item1 = await wishList.addItem(alice, {
    name: 'MacBook Pro',
    description: '16-inch MacBook Pro with M3 chip',
    url: 'https://example.com/macbook',
    price: 2499,
    priority: 'high',
  });
  console.log(`   ✅ Added: ${item1.item.name} (${item1.itemId})`);
  console.log(`   Status: ${item1.item.status}\n`);

  const item2 = await wishList.addItem(alice, {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    url: 'https://example.com/mouse',
    price: 79,
    priority: 'medium',
  });
  console.log(`   ✅ Added: ${item2.item.name} (${item2.itemId})`);

  const item3 = await wishList.addItem(alice, {
    name: 'Desk Lamp',
    description: 'LED desk lamp with adjustable brightness',
    price: 45,
    priority: 'low',
  });
  console.log(`   ✅ Added: ${item3.item.name} (${item3.itemId})\n`);

  // Bob reserves an item from Alice's wish list
  console.log('🎯 Bob reserves MacBook Pro from Alice:');
  const reservation = await wishList.reserveItem(
    alice,
    item1.itemId,
    bob,
  );
  console.log(`   ✅ Reserved by: ${reservation.reservedBy}`);
  console.log(`   Item: ${reservation.item.name}`);
  console.log(`   Status: ${reservation.item.status}\n`);

  // Charlie tries to reserve the same item (should fail)
  console.log('❌ Charlie tries to reserve the same item:');
  try {
    await wishList.reserveItem(alice, item1.itemId, charlie);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Charlie reserves a different item
  console.log('🎯 Charlie reserves Desk Lamp from Alice:');
  const reservation2 = await wishList.reserveItem(
    alice,
    item3.itemId,
    charlie,
  );
  console.log(`   ✅ Reserved by: ${reservation2.reservedBy}`);
  console.log(`   Item: ${reservation2.item.name}\n`);

  // Alice views her wish list
  console.log('📋 Alice views her wish list:');
  const aliceWishList = await wishList.getWishList(alice);
  console.log(`   Total items: ${aliceWishList.totalItems}`);
  aliceWishList.items.forEach((item, idx) => {
    const reserved = item.reservedBy
      ? ` (reserved by ${item.reservedBy})`
      : '';
    console.log(
      `   ${idx + 1}. ${item.name} - ${item.status}${reserved}`,
    );
  });

  // View only available items
  console.log('\n📋 Available items in Alice\'s wish list:');
  const availableItems = await wishList.getWishList(alice, 'available');
  console.log(`   Available: ${availableItems.totalItems}`);
  availableItems.items.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.name} - $${item.price || 'N/A'}`);
  });

  // Bob views his reservations
  console.log('\n🎁 Bob\'s reservations:');
  const bobReservations = await wishList.getReservations(bob);
  console.log(`   Total reservations: ${bobReservations.reservations.length}`);
  bobReservations.reservations.forEach((res, idx) => {
    console.log(
      `   ${idx + 1}. ${res.itemName} (for ${res.ownerId}) - ${res.status}`,
    );
  });

  // Alice marks MacBook as fulfilled
  console.log('\n✅ Alice marks MacBook Pro as fulfilled:');
  const update = await wishList.updateStatus(alice, item1.itemId, 'fulfilled');
  console.log(`   Status changed: ${update.oldStatus} → ${update.newStatus}`);

  // View fulfilled items
  console.log('\n📋 Fulfilled items:');
  const fulfilledItems = await wishList.getWishList(alice, 'fulfilled');
  fulfilledItems.items.forEach((item) => {
    console.log(`   - ${item.name}`);
  });

  // Validate chain integrity
  const isValid = await chain.isValid();
  console.log(`\n🕵️  Blockchain valid: ${isValid}`);
};

main().catch(console.error);

