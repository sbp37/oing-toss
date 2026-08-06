import { ITEM_DEFINITIONS } from './data.js';

export const INVENTORY_SOURCES = Object.freeze({
  RUN: 'run',
  EARNED: 'earned',
  AD: 'ad',
  IAP: 'iap',
  SUPPORT: 'support',
});

const VALID_SOURCES = new Set(Object.values(INVENTORY_SOURCES));

function validQuantity(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export class InventoryLedger {
  constructor(definitions = ITEM_DEFINITIONS) {
    this.definitions = definitions;
    this.balances = new Map();
    this.processedGrantIds = new Set();
    this.entries = [];
    Object.values(definitions).forEach(({ id, initial = 0 }) => {
      this.balances.set(id, Math.max(0, Math.trunc(initial)));
    });
  }

  snapshot() {
    return Object.fromEntries(this.balances.entries());
  }

  balance(itemId) {
    return this.balances.get(itemId) ?? 0;
  }

  canConsume(itemId, quantity = 1) {
    return this.balances.has(itemId) && validQuantity(quantity) && this.balance(itemId) >= quantity;
  }

  consume(itemId, quantity = 1) {
    if (!this.balances.has(itemId)) return { ok: false, reason: 'unknown-item' };
    if (!validQuantity(quantity)) return { ok: false, reason: 'invalid-quantity' };
    if (this.balance(itemId) < quantity) return { ok: false, reason: 'insufficient-balance' };
    const next = this.balance(itemId) - quantity;
    this.balances.set(itemId, next);
    this.entries.push(Object.freeze({ type: 'consume', itemId, quantity, balance: next }));
    return { ok: true, balance: next };
  }

  grant(itemId, quantity, metadata = {}) {
    return this.grantBundle({ [itemId]: quantity }, metadata);
  }

  grantBundle(grants, { source = INVENTORY_SOURCES.EARNED, grantId = null } = {}) {
    if (!VALID_SOURCES.has(source)) return { ok: false, reason: 'invalid-source' };
    if (source === INVENTORY_SOURCES.IAP && !grantId) return { ok: false, reason: 'grant-id-required' };
    if (grantId && this.processedGrantIds.has(grantId)) {
      return { ok: true, duplicate: true, balances: this.snapshot() };
    }

    const entries = Object.entries(grants || {});
    if (!entries.length) return { ok: false, reason: 'empty-grant' };
    for (const [itemId, quantity] of entries) {
      if (!this.balances.has(itemId)) return { ok: false, reason: 'unknown-item', itemId };
      if (!validQuantity(quantity)) return { ok: false, reason: 'invalid-quantity', itemId };
    }

    entries.forEach(([itemId, quantity]) => {
      this.balances.set(itemId, this.balance(itemId) + quantity);
    });
    if (grantId) this.processedGrantIds.add(grantId);
    this.entries.push(Object.freeze({
      type: 'grant',
      source,
      grantId,
      grants: Object.freeze(Object.fromEntries(entries)),
    }));
    return { ok: true, duplicate: false, balances: this.snapshot() };
  }

  journal() {
    return this.entries.map((entry) => ({ ...entry, grants: entry.grants ? { ...entry.grants } : undefined }));
  }
}

export function createRunInventory() {
  return new InventoryLedger(ITEM_DEFINITIONS);
}
