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
- Combo-earned bomb/clock/mega-bomb drops live inside empty board cells and are separate
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

## Banner ads: decided placement (2026-08)

**Banners go on the home and result screens only. Never on the play screen.**

The reason is not layout — it is mistaps. The play screen is a drag game, and
the item dock sits directly above where a bottom banner would go. A drag that
runs off the bottom, or a hurried item tap that misses, lands on the ad. That
annoys players, and ad networks treat the resulting click pattern as invalid
traffic, which puts the account at risk. Home and result screens are also
better inventory: the player is stopped and looking at them, while a play
screen impression lasts two or three minutes at most.

For revenue during play, rewarded ads fit this game far better than a banner.
The ledger already accepts `source: 'ad'` grants, so "watch to get one more
hint" needs no new boundary.

### If a banner is added later

Do not adjust each screen. The layout already reserves the bottom edge through
one variable, and every bottom-anchored element follows it:

```css
--ad-bottom: 0px;   /* set from the SDK's reported banner height */
--safe-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--ad-bottom));
```

Measured headroom (real runs, board and dock geometry read at runtime):

| Reserved bottom | 390x844 | 360x640 |
| --- | --- | --- |
| up to ~130px | board unchanged | board unchanged |
| ~130px | speech bubble auto-collapses | collapses from ~60px |
| ~170px | board unchanged | board starts shrinking |
| ~210px | board starts shrinking | too tight to use |

A standard AdMob banner is 50dp (about 60 CSS px) and a large one about 90px,
so both sit well inside the safe range on either device. The dock keeps a fixed
30px gap below it (16px on the small phone); that gap was sized for the home
indicator, not for an ad, so a play-screen banner would need its own clearance
on top of it — one more reason to keep banners off that screen.
