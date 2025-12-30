'use strict';

const { SmartContract } = require('../lib/contract.js');

/**
 * Bridge USDC Token System
 *
 * Implements a bridged version of USDC with:
 * - Balance tracking
 * - Transfers between addresses
 * - Transaction history
 * - Balance queries
 */

class Token {
  #storage;
  #chain;
  #transferContract;
  #mintContract;
  #burnContract;

  constructor(name, symbol, { storage, chain }) {
    this.name = name;
    this.symbol = symbol;
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

      // Save both balances
      await storage.saveData(`balance:${from}`, newFromBalance);
      await storage.saveData(`balance:${to}`, newToBalance);

      // Log transaction
      const tx = {
        type: 'transfer',
        from,
        to,
        amount,
        timestamp: Date.now(),
        txId: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await chain.addBlock({
        type: 'token-transfer',
        ...tx,
      });

      return {
        success: true,
        txId: tx.txId,
        fromBalance: newFromBalance.balance,
        toBalance: newToBalance.balance,
      };
    };

    this.#transferContract = new SmartContract(
      `${this.symbol}-transfer`,
      transferProc,
      { storage: this.#storage, chain: this.#chain },
    );

    // Initialize mint contract (for bridge deposits)
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

      await storage.saveData(`balance:${to}`, newBalance);

      const tx = {
        type: 'mint',
        to,
        amount,
        bridgeTxHash,
        timestamp: Date.now(),
        txId: `mint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await chain.addBlock({
        type: 'token-mint',
        ...tx,
      });

      return {
        success: true,
        txId: tx.txId,
        balance: newBalance.balance,
      };
    };

    this.#mintContract = new SmartContract(`${this.symbol}-mint`, mintProc, {
      storage: this.#storage,
      chain: this.#chain,
    });

    // Initialize burn contract (for bridge withdrawals)
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

      await storage.saveData(`balance:${from}`, newBalance);

      const tx = {
        type: 'burn',
        from,
        amount,
        bridgeAddress,
        timestamp: Date.now(),
        txId: `burn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await chain.addBlock({
        type: 'token-burn',
        ...tx,
      });

      return {
        success: true,
        txId: tx.txId,
        balance: newBalance.balance,
      };
    };

    this.#burnContract = new SmartContract(`${this.symbol}-burn`, burnProc, {
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

  async getTotalSupply() {
    // This would require iterating all balances or maintaining a total supply record
    // For simplicity, we'll track it separately
    const totalSupply = await this.#storage.loadData('total-supply');
    return totalSupply ? totalSupply.amount : 0;
  }

  // Expose storage and chain for bonding curve integration
  _getStorage() {
    return this.#storage;
  }

  _getChain() {
    return this.#chain;
  }
}

module.exports = { Token };
