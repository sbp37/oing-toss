# OING monetization boundary

The current public web build has no payment UI or Apps in Toss SDK. It only
contains the inventory boundary needed to add those systems later.

## Current behavior

- Every run starts with three hints, two shuffles, one bomb, and one clock.
- `InventoryLedger` owns all item balances and consumption.
- Grants identify their source as `earned`, `ad`, `iap`, or `support`.
- IAP grants require a stable `grantId`; replaying the same ID is idempotent.
- Bundle grants validate every item before changing any balance.
- Bomb clears a 3x3 area and carries the current combo; clock adds eight seconds.
- Bomb and clock are free prototype trials. No paid grant is connected yet.
- Combo-earned bomb/clock drops live inside empty board cells and are separate
  from the bottom free-run inventory. They are gameplay rewards, not paid stock.
- Unused earned drops carry to the next board through an in-memory pending queue;
  they are intentionally not persisted as purchasable inventory.
- Freeze and clover remain hidden and unimplemented.

## Future Apps in Toss flow

1. Fetch product names, icons, and prices from the IAP SDK rather than hardcoding them.
2. Create an order through the SDK and pause the game timer/audio while its sheet is open.
3. Verify the order and grant contents on a partner server.
4. Call `grantItems(product.grants, { source: 'iap', grantId: orderId })` only after verification.
5. Complete product grant and restore pending orders on app startup.
6. Reconcile refunds and device changes against server-side order state.

Paid inventory must never use localStorage as its source of truth. The in-memory
ledger in this prototype is a gameplay boundary, not a payment database.
