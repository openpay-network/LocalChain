'use strict';

const { SmartContract } = require('../lib/contract.js');

/**
 * Bonding Curve Implementation
 *
 * A bonding curve defines the relationship between token supply and price.
 * As tokens are bought (minted), the price increases.
 * As tokens are sold (burned), the price decreases.
 *
 * Supported curve types:
 * - linear: price = k * supply
 * - polynomial: price = k * supply^n
 * - exponential: price = k * e^(r * supply)
 */

class BondingCurve {
  #storage;
  #chain;
  #token;
  #buyContract;
  #sellContract;
  #curveType;
  #k; // constant multiplier
  #n; // polynomial exponent (for polynomial curves)
  #r; // rate (for exponential curves)

  constructor(
    token,
    {
      curveType = 'linear',
      k = 0.001, // price constant
      n = 2, // polynomial exponent
      r = 0.01, // exponential rate
    } = {},
  ) {
    this.#token = token;
    this.#storage = token._getStorage();
    this.#chain = token._getChain();
    this.#curveType = curveType;
    this.#k = k;
    this.#n = n;
    this.#r = r;
  }

  /**
   * Calculate price for a given supply
   */
  calculatePrice(supply) {
    switch (this.#curveType) {
      case 'linear':
        return this.#k * supply;
      case 'polynomial':
        return this.#k * Math.pow(supply, this.#n);
      case 'exponential':
        return this.#k * Math.exp(this.#r * supply);
      default:
        throw new Error(`Unknown curve type: ${this.#curveType}`);
    }
  }

  /**
   * Calculate integral (area under curve) for price calculation
   * This gives the total cost to buy from supply1 to supply2
   */
  calculateIntegral(supply1, supply2) {
    switch (this.#curveType) {
      case 'linear':
        return (this.#k / 2) * (supply2 * supply2 - supply1 * supply1);
      case 'polynomial':
        return (
          (this.#k / (this.#n + 1)) *
          (Math.pow(supply2, this.#n + 1) - Math.pow(supply1, this.#n + 1))
        );
      case 'exponential':
        return (
          (this.#k / this.#r) *
          (Math.exp(this.#r * supply2) - Math.exp(this.#r * supply1))
        );
      default:
        throw new Error(`Unknown curve type: ${this.#curveType}`);
    }
  }

  /**
   * Calculate how many tokens can be bought with a given amount of payment
   */
  calculateTokensForPayment(currentSupply, paymentAmount) {
    // Binary search to find the new supply that costs paymentAmount
    let low = currentSupply;
    let high = currentSupply + paymentAmount / this.#k; // upper bound estimate
    const tolerance = 0.0001;
    const maxIterations = 100;

    for (let i = 0; i < maxIterations; i++) {
      const mid = (low + high) / 2;
      const cost = this.calculateIntegral(currentSupply, mid);

      if (Math.abs(cost - paymentAmount) < tolerance) {
        return mid - currentSupply;
      }

      if (cost < paymentAmount) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return (low + high) / 2 - currentSupply;
  }

  /**
   * Calculate payment needed to buy a given amount of tokens
   */
  calculatePaymentForTokens(currentSupply, tokenAmount) {
    const newSupply = currentSupply + tokenAmount;
    return this.calculateIntegral(currentSupply, newSupply);
  }

  /**
   * Calculate payment received for selling a given amount of tokens
   */
  calculatePaymentForSale(currentSupply, tokenAmount) {
    const newSupply = currentSupply - tokenAmount;
    if (newSupply < 0) {
      throw new Error('Cannot sell more tokens than exist');
    }
    return this.calculateIntegral(newSupply, currentSupply);
  }

  async initialize() {
    const storage = this.#storage;
    const chain = this.#chain;
    const curve = this;

    // Buy contract: user pays, receives tokens
    const buyProc = async (reader, args) => {
      const { buyer, paymentAmount } = args;

      if (paymentAmount <= 0) {
        throw new Error('Payment amount must be positive');
      }

      // Get current supply
      const supplyData = (await reader.get('bonding-curve:supply')) || {
        supply: 0,
      };
      const currentSupply = supplyData.supply;

      // Calculate tokens to mint
      const tokenAmount = curve.calculateTokensForPayment(
        currentSupply,
        paymentAmount,
      );

      if (tokenAmount <= 0) {
        throw new Error('Token amount must be positive');
      }

      // Calculate actual price paid (may differ slightly due to approximation)
      const actualPrice = curve.calculatePaymentForTokens(
        currentSupply,
        tokenAmount,
      );

      // Update supply
      const newSupply = currentSupply + tokenAmount;
      await storage.saveData('bonding-curve:supply', {
        supply: newSupply,
        updated: Date.now(),
      });

      // Mint tokens to buyer
      const buyerBalance = (await reader.get(`balance:${buyer}`)) || {
        balance: 0,
      };
      await storage.saveData(`balance:${buyer}`, {
        address: buyer,
        balance: buyerBalance.balance + tokenAmount,
        updated: Date.now(),
      });

      // Track payment (could be in a separate payment token or native currency)
      const paymentData = (await reader.get('bonding-curve:payments')) || {
        total: 0,
      };
      await storage.saveData('bonding-curve:payments', {
        total: paymentData.total + actualPrice,
        updated: Date.now(),
      });

      // Log transaction
      const tx = {
        type: 'bonding-curve-buy',
        buyer,
        paymentAmount: actualPrice,
        tokenAmount,
        price: actualPrice / tokenAmount,
        supplyBefore: currentSupply,
        supplyAfter: newSupply,
        timestamp: Date.now(),
        txId: `buy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await chain.addBlock(tx);

      return {
        success: true,
        txId: tx.txId,
        tokenAmount,
        paymentAmount: actualPrice,
        price: actualPrice / tokenAmount,
        newSupply,
        buyerBalance: buyerBalance.balance + tokenAmount,
      };
    };

    this.#buyContract = new SmartContract('bonding-curve-buy', buyProc, {
      storage: this.#storage,
      chain: this.#chain,
    });

    // Sell contract: user sells tokens, receives payment
    const sellProc = async (reader, args) => {
      const { seller, tokenAmount } = args;

      if (tokenAmount <= 0) {
        throw new Error('Token amount must be positive');
      }

      // Check seller balance
      const sellerBalance = (await reader.get(`balance:${seller}`)) || {
        balance: 0,
      };
      if (sellerBalance.balance < tokenAmount) {
        throw new Error(
          `Insufficient balance. Available: ${sellerBalance.balance}`,
        );
      }

      // Get current supply
      const supplyData = (await reader.get('bonding-curve:supply')) || {
        supply: 0,
      };
      const currentSupply = supplyData.supply;

      if (currentSupply < tokenAmount) {
        throw new Error('Cannot sell more tokens than total supply');
      }

      // Calculate payment for selling
      const paymentAmount = curve.calculatePaymentForSale(
        currentSupply,
        tokenAmount,
      );

      // Update supply
      const newSupply = currentSupply - tokenAmount;
      await storage.saveData('bonding-curve:supply', {
        supply: newSupply,
        updated: Date.now(),
      });

      // Burn tokens from seller
      await storage.saveData(`balance:${seller}`, {
        address: seller,
        balance: sellerBalance.balance - tokenAmount,
        updated: Date.now(),
      });

      // Update payment reserve
      const paymentData = (await reader.get('bonding-curve:payments')) || {
        total: 0,
      };
      const newPaymentTotal = Math.max(0, paymentData.total - paymentAmount);
      await storage.saveData('bonding-curve:payments', {
        total: newPaymentTotal,
        updated: Date.now(),
      });

      // Log transaction
      const tx = {
        type: 'bonding-curve-sell',
        seller,
        paymentAmount,
        tokenAmount,
        price: paymentAmount / tokenAmount,
        supplyBefore: currentSupply,
        supplyAfter: newSupply,
        timestamp: Date.now(),
        txId: `sell-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      await chain.addBlock(tx);

      return {
        success: true,
        txId: tx.txId,
        tokenAmount,
        paymentAmount,
        price: paymentAmount / tokenAmount,
        newSupply,
        sellerBalance: sellerBalance.balance - tokenAmount,
      };
    };

    this.#sellContract = new SmartContract('bonding-curve-sell', sellProc, {
      storage: this.#storage,
      chain: this.#chain,
    });
  }

  async buy(buyer, paymentAmount) {
    return this.#buyContract.execute({
      id: `buy-${Date.now()}`,
      buyer,
      paymentAmount,
    });
  }

  async sell(seller, tokenAmount) {
    return this.#sellContract.execute({
      id: `sell-${Date.now()}`,
      seller,
      tokenAmount,
    });
  }

  async getCurrentPrice() {
    const supplyData = await this.#storage.loadData('bonding-curve:supply');
    const currentSupply = supplyData ? supplyData.supply : 0;
    return this.calculatePrice(currentSupply);
  }

  async getSupply() {
    const supplyData = await this.#storage.loadData('bonding-curve:supply');
    return supplyData ? supplyData.supply : 0;
  }

  async getPaymentReserve() {
    const paymentData = await this.#storage.loadData('bonding-curve:payments');
    return paymentData ? paymentData.total : 0;
  }

  getCurveInfo() {
    return {
      curveType: this.#curveType,
      k: this.#k,
      n: this.#n,
      r: this.#r,
    };
  }
}

module.exports = { BondingCurve };
