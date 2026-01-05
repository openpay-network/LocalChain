'use strict';

const { SmartContract } = require('../lib/contract.js');

/**
 * Private Token System
 *
 * Implements a private token with encrypted storage:
 * - All balances stored encrypted (using built-in encryption)
 * - Transfer operations
 * - Mint and burn operations
 * - Simple and clean implementation
 */

class PrivateToken {
  #storage;
  #chain;
  #transferContract;
  #mintContract;
  #burnContract;

  constructor({ storage, chain }) {
    this.#storage = storage;
    this.#chain = chain;
  }

  async initialize() {
    const storage = this.#storage;
    const chain = this.#chain;

    // Initialize transfer contract
    const transferProc = async (reader, args) => {
      const { from, to, amount } = args;

      if (amount <= 0) {
        throw new Error('Transfer amount must be positive');
      }

      // Get sender balance
      const fromBalance = (await reader.get(`balance:${from}`)) || {
        balance: 0,
      };
      if (fromBalance.balance < amount) {
        throw new Error(
          `Insufficient balance. Available: ${fromBalance.balance}`,
        );
      }

      // Get receiver balance
      const toBalance = (await reader.get(`balance:${to}`)) || { balance: 0 };

      // Update balances
      const newFromBalance = {
        address: from,
        balance: fromBalance.balance - amount,
        updated: Date.now(),
      };

      const newToBalance = {
        address: to,
        balance: toBalance.balance + amount,
        updated: Date.now(),
      };

      // Save both balances with encryption
      await storage.saveData(`balance:${from}`, newFromBalance, {
        encrypted: true,
      });
      await storage.saveData(`balance:${to}`, newToBalance, {
        encrypted: true,
      });

      return {
        success: true,
        fromBalance: newFromBalance.balance,
        toBalance: newToBalance.balance,
      };
    };

    this.#transferContract = new SmartContract(
      'private-token-transfer',
      transferProc,
      {
        storage: this.#storage,
        chain: this.#chain,
      },
    );

    // Initialize mint contract
    const mintProc = async (reader, args) => {
      const { to, amount, bridgeTxHash } = args;

      if (amount <= 0) {
        throw new Error('Mint amount must be positive');
      }

      const balance = (await reader.get(`balance:${to}`)) || { balance: 0 };
      const newBalance = {
        address: to,
        balance: balance.balance + amount,
        updated: Date.now(),
      };

      // Save balance with encryption
      await storage.saveData(`balance:${to}`, newBalance, {
        encrypted: true,
      });

      return {
        success: true,
        balance: newBalance.balance,
      };
    };

    this.#mintContract = new SmartContract('private-token-mint', mintProc, {
      storage: this.#storage,
      chain: this.#chain,
    });

    // Initialize burn contract
    const burnProc = async (reader, args) => {
      const { from, amount, bridgeAddress } = args;

      if (amount <= 0) {
        throw new Error('Burn amount must be positive');
      }

      const balance = (await reader.get(`balance:${from}`)) || { balance: 0 };
      if (balance.balance < amount) {
        throw new Error(`Insufficient balance. Available: ${balance.balance}`);
      }

      const newBalance = {
        address: from,
        balance: balance.balance - amount,
        updated: Date.now(),
      };

      // Save balance with encryption
      await storage.saveData(`balance:${from}`, newBalance, {
        encrypted: true,
      });

      return {
        success: true,
        balance: newBalance.balance,
      };
    };

    this.#burnContract = new SmartContract('private-token-burn', burnProc, {
      storage: this.#storage,
      chain: this.#chain,
    });
  }

  async transfer(from, to, amount) {
    return this.#transferContract.execute({
      id: `transfer-${Date.now()}`,
      from,
      to,
      amount,
    });
  }

  async mint(to, amount, bridgeTxHash = null) {
    return this.#mintContract.execute({
      id: `mint-${Date.now()}`,
      to,
      amount,
      bridgeTxHash,
    });
  }

  async burn(from, amount, bridgeAddress) {
    return this.#burnContract.execute({
      id: `burn-${Date.now()}`,
      from,
      amount,
      bridgeAddress,
    });
  }

  async getBalance(address) {
    const balance = await this.#storage.loadData(`balance:${address}`);
    return balance ? balance.balance : 0;
  }
}

module.exports = { PrivateToken };
