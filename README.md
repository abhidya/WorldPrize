# WorldPrize

WorldPrize is a small open-source monorepo that demonstrates how World ID can protect the no-purchase / free-entry path in instant-win product promotions.

It is an interview demo and reference integration, not a full SaaS product and not an ePrize clone.

## What’s in the repo

```text
packages/
  core/           generic promotion engine
  world-id/       World ID verification adapter and action helpers
  storage-memory/ memory-backed demo storage
apps/
  demo/           Next.js demo app
docs/             architecture, setup, interview script, and limitations
```

## Product idea

Consumer brands run instant-win promotions where customers buy a product, find a code, enter it, and instantly see whether they won merch, coupons, gift cards, or a digital reward.

Because chance-based purchase promotions generally need a no-purchase / free method of entry, the free-entry path can be abused by scripts, fake emails, repeated accounts, and entry farms.

WorldPrize demonstrates how World ID can protect that free-entry path:

- the product-code route stays available
- the no-purchase / free daily entry route requires World ID verification
- the backend stores a campaign/day nullifier so one verified human can only use the free route once per day

## Quick start

```bash
pnpm install
pnpm dev
```

Then open the demo app from `apps/demo`.

## Environment

Copy `.env.example` to the demo app environment file and set your secrets there.

Required values:

- `NEXT_PUBLIC_WORLD_APP_ID=app_25d16ee7904752aca5fef279f2fe11c7`
- `WORLD_RP_ID=rp_3d1c7269a4c866a7`
- `WORLD_ACTION_FREE_ENTRY=worldprize-free-entry-demo`
- `WORLD_SIGNING_KEY=...` server-only secret

`WORLD_SIGNING_KEY` must never be exposed client-side.

## Demo behavior

Expected demo outcomes:

- `SNACK-123` works once
- reusing `SNACK-123` returns `CODE_USED`
- invalid codes return `INVALID_CODE`
- Alice free entry works once today
- Alice’s second free entry today returns `ALREADY_ENTERED`
- Bob free entry works separately
- bot/no-proof returns `INVALID_PROOF`
- random odds can return `WIN` or `LOSE`
- prize inventory never goes below zero
- admin stats update
- public audit pages mask nullifiers

## Important docs

- `docs/architecture.md`
- `docs/world-developer-portal-setup.md`
- `docs/world-id-integration.md`
- `docs/commercial-feature-map.md`
- `docs/legal-limitations.md`
- `docs/interview-demo-script.md`

## What not to build

- full ePrize replacement
- multi-tenant SaaS
- brand account system
- visual campaign builder
- legal rules generator
- tax forms
- physical fulfillment
- receipt OCR
- email/SMS marketing
- referral system
- real crypto escrow/payout
- onchain randomness
- random OSS fork
