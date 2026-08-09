import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT_CATALOG } from '../js/data.js';
import { INVENTORY_SOURCES, createRunInventory } from '../js/inventory.js';

test('run inventory starts with the approved free item counts', () => {
  const inventory = createRunInventory();
  assert.equal(inventory.balance('hint'), 3);
  assert.equal(inventory.balance('shuffle'), 2);
  assert.equal(inventory.balance('bomb'), 0);
  assert.equal(inventory.balance('clock'), 0);
});

test('consuming items cannot underflow or create unknown balances', () => {
  const inventory = createRunInventory();
  assert.equal(inventory.consume('hint').ok, true);
  assert.equal(inventory.balance('hint'), 2);
  assert.equal(inventory.consume('bomb').reason, 'insufficient-balance');
  assert.equal(inventory.grant('bomb', 1).ok, true);
  assert.equal(inventory.consume('bomb').ok, true);
  assert.equal(inventory.consume('bomb').reason, 'insufficient-balance');
  assert.equal(inventory.consume('clock').reason, 'insufficient-balance');
  assert.equal(inventory.consume('missing').reason, 'unknown-item');
});

test('IAP grants require a stable ID and are idempotent', () => {
  const inventory = createRunInventory();
  const grants = PRODUCT_CATALOG.hint5.grants;
  assert.equal(inventory.grantBundle(grants, { source: INVENTORY_SOURCES.IAP }).reason, 'grant-id-required');
  const first = inventory.grantBundle(grants, { source: INVENTORY_SOURCES.IAP, grantId: 'order-123' });
  const duplicate = inventory.grantBundle(grants, { source: INVENTORY_SOURCES.IAP, grantId: 'order-123' });
  assert.equal(first.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(inventory.balance('hint'), 8);
});

test('bundle grants validate atomically before changing balances', () => {
  const inventory = createRunInventory();
  const before = inventory.snapshot();
  const failed = inventory.grantBundle({ hint: 2, missing: 1 }, { source: INVENTORY_SOURCES.EARNED });
  assert.equal(failed.ok, false);
  assert.deepEqual(inventory.snapshot(), before);
});
