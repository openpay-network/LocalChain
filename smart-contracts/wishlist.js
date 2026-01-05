'use strict';

const { SmartContract } = require('../lib/contract.js');

/**
 * Wish List Smart Contract
 *
 * Implements a wish list system with:
 * - Add new items with statuses
 * - Reserve items by other users
 * - Track item status (available, reserved, fulfilled)
 * - User wish list management
 */

class WishList {
  #storage;
  #chain;
  #addItemContract;
  #reserveItemContract;
  #updateStatusContract;
  #getWishListContract;

  constructor({ storage, chain }) {
    this.#storage = storage;
    this.#chain = chain;
  }

  async initialize() {
    const storage = this.#storage;
    const chain = this.#chain;

    // Add item contract: creates a new wish list item
    const addItemProc = async (reader, args) => {
      const { userId, item } = args;

      if (!userId || !item) {
        throw new Error('Missing required fields: userId, item');
      }

      if (!item.name || !item.description) {
        throw new Error('Item must have name and description');
      }

      // Get user's wish list
      const wishList = (await reader.get(`wishlist:${userId}`)) || {
        userId,
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Create new item
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        description: item.description,
        url: item.url || null,
        price: item.price || null,
        priority: item.priority || 'medium', // low, medium, high
        status: 'available', // available, reserved, fulfilled
        reservedBy: null,
        reservedAt: null,
        createdAt: Date.now(),
        metadata: item.metadata || {},
      };

      // Add item to wish list
      wishList.items.push(newItem);
      wishList.updatedAt = Date.now();

      // Save updated wish list
      await storage.saveData(`wishlist:${userId}`, wishList);

      // Log to blockchain
      await chain.addBlock({
        type: 'wishlist-item-added',
        userId,
        itemId: newItem.id,
        itemName: newItem.name,
        timestamp: Date.now(),
      });

      return {
        success: true,
        item: newItem,
        itemId: newItem.id,
        totalItems: wishList.items.length,
      };
    };

    this.#addItemContract = new SmartContract(
      'wishlist-add-item',
      addItemProc,
      {
        storage: this.#storage,
        chain: this.#chain,
      },
    );

    // Reserve item contract: allows another user to reserve an item
    const reserveItemProc = async (reader, args) => {
      const { ownerId, itemId, reservedBy } = args;

      if (!ownerId || !itemId || !reservedBy) {
        throw new Error('Missing required fields: ownerId, itemId, reservedBy');
      }

      // Get owner's wish list
      const wishList = await reader.get(`wishlist:${ownerId}`);

      if (!wishList) {
        throw new Error(`Wish list not found for user ${ownerId}`);
      }

      // Find the item
      const itemIndex = wishList.items.findIndex((item) => item.id === itemId);

      if (itemIndex === -1) {
        throw new Error(`Item ${itemId} not found in wish list`);
      }

      const item = wishList.items[itemIndex];

      // Validate item can be reserved
      if (item.status !== 'available') {
        throw new Error(
          `Item is not available. Current status: ${item.status}`,
        );
      }

      if (item.reservedBy) {
        throw new Error('Item is already reserved');
      }

      // Cannot reserve your own item
      if (ownerId === reservedBy) {
        throw new Error('Cannot reserve your own item');
      }

      // Update item status
      item.status = 'reserved';
      item.reservedBy = reservedBy;
      item.reservedAt = Date.now();
      wishList.updatedAt = Date.now();

      // Save updated wish list
      await storage.saveData(`wishlist:${ownerId}`, wishList);

      // Track reservation for the reserver
      const reserverReservations = (await reader.get(
        `reservations:${reservedBy}`,
      )) || {
        userId: reservedBy,
        reservations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      reserverReservations.reservations.push({
        itemId,
        ownerId,
        itemName: item.name,
        reservedAt: Date.now(),
        status: 'reserved',
      });
      reserverReservations.updatedAt = Date.now();

      await storage.saveData(
        `reservations:${reservedBy}`,
        reserverReservations,
      );

      // Log to blockchain
      await chain.addBlock({
        type: 'wishlist-item-reserved',
        ownerId,
        itemId,
        reservedBy,
        itemName: item.name,
        timestamp: Date.now(),
      });

      return {
        success: true,
        item,
        ownerId,
        reservedBy,
        reservedAt: item.reservedAt,
      };
    };

    this.#reserveItemContract = new SmartContract(
      'wishlist-reserve-item',
      reserveItemProc,
      { storage: this.#storage, chain: this.#chain },
    );

    // Update status contract: allows owner to update item status
    const updateStatusProc = async (reader, args) => {
      const { userId, itemId, status } = args;

      if (!userId || !itemId || !status) {
        throw new Error('Missing required fields: userId, itemId, status');
      }

      const validStatuses = ['available', 'reserved', 'fulfilled', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(
          `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        );
      }

      // Get user's wish list
      const wishList = await reader.get(`wishlist:${userId}`);

      if (!wishList) {
        throw new Error(`Wish list not found for user ${userId}`);
      }

      // Find the item
      const itemIndex = wishList.items.findIndex((item) => item.id === itemId);

      if (itemIndex === -1) {
        throw new Error(`Item ${itemId} not found in wish list`);
      }

      const item = wishList.items[itemIndex];
      const oldStatus = item.status;

      // Update status
      item.status = status;
      wishList.updatedAt = Date.now();

      // If marking as fulfilled or cancelled, clear reservation
      if (status === 'fulfilled' || status === 'cancelled') {
        if (item.reservedBy) {
          // Update reserver's reservation status
          const reserverReservations = await reader.get(
            `reservations:${item.reservedBy}`,
          );
          if (reserverReservations) {
            const reservation = reserverReservations.reservations.find(
              (r) => r.itemId === itemId,
            );
            if (reservation) {
              reservation.status = status;
              reserverReservations.updatedAt = Date.now();
              await storage.saveData(
                `reservations:${item.reservedBy}`,
                reserverReservations,
              );
            }
          }
        }
        item.reservedBy = null;
        item.reservedAt = null;
      }

      // Save updated wish list
      await storage.saveData(`wishlist:${userId}`, wishList);

      // Log to blockchain
      await chain.addBlock({
        type: 'wishlist-status-updated',
        userId,
        itemId,
        oldStatus,
        newStatus: status,
        timestamp: Date.now(),
      });

      return {
        success: true,
        item,
        oldStatus,
        newStatus: status,
      };
    };

    this.#updateStatusContract = new SmartContract(
      'wishlist-update-status',
      updateStatusProc,
      { storage: this.#storage, chain: this.#chain },
    );

    // Get wish list contract: retrieves user's wish list
    const getWishListProc = async (reader, args) => {
      const { userId, statusFilter } = args;

      if (!userId) {
        throw new Error('Missing required field: userId');
      }

      // Get user's wish list
      const wishList = await reader.get(`wishlist:${userId}`);

      if (!wishList) {
        return {
          userId,
          items: [],
          totalItems: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      // Apply status filter if provided
      let items = wishList.items || [];
      if (statusFilter) {
        items = items.filter((item) => item.status === statusFilter);
      }

      // Sort by priority and creation date
      items = items.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff =
          (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

      return {
        userId: wishList.userId,
        items,
        totalItems: items.length,
        totalAllItems: wishList.items.length,
        createdAt: wishList.createdAt,
        updatedAt: wishList.updatedAt,
      };
    };

    this.#getWishListContract = new SmartContract(
      'wishlist-get',
      getWishListProc,
      { storage: this.#storage, chain: this.#chain },
    );
  }

  /**
   * Add a new item to wish list
   */
  async addItem(userId, item) {
    return this.#addItemContract.execute({
      id: `add-${Date.now()}`,
      userId,
      item,
    });
  }

  /**
   * Reserve an item from someone's wish list
   */
  async reserveItem(ownerId, itemId, reservedBy) {
    return this.#reserveItemContract.execute({
      id: `reserve-${Date.now()}`,
      ownerId,
      itemId,
      reservedBy,
    });
  }

  /**
   * Update item status
   */
  async updateStatus(userId, itemId, status) {
    return this.#updateStatusContract.execute({
      id: `status-${Date.now()}`,
      userId,
      itemId,
      status,
    });
  }

  /**
   * Get user's wish list
   */
  async getWishList(userId, statusFilter = null) {
    return this.#getWishListContract.execute({
      id: `get-${Date.now()}`,
      userId,
      statusFilter,
    });
  }

  /**
   * Get user's reservations (items they've reserved for others)
   */
  async getReservations(userId) {
    const reservations = await this.#storage.loadData(`reservations:${userId}`);
    return (
      reservations || {
        userId,
        reservations: [],
        totalReservations: 0,
      }
    );
  }
}

module.exports = { WishList };
