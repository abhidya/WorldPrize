# WorldPrize

WorldPrize is a small open-source monorepo that demonstrates how World ID can protect the no-purchase / free-entry path in instant-win product promotions.

It is an interview demo and reference integration, not a full SaaS product and not an ePrize clone.

## Deployment modes

- **Mock-first Vercel demo:** the current Vercel-ready demo uses deterministic mock humans and in-memory state so interviews are repeatable.
- **Real mode:** server-side IDKit verification, backend RP signing, verification at the World verifier endpoint, and persistent nullifier storage. Set `WORLDPRIZE_MODE=real` and `NEXT_PUBLIC_WORLDPRIZE_MODE=real` to activate.

GitHub Pages is **mock-only**. It cannot run backend signing, verifier, or persistent storage required for real World ID verification.

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

## URLs

- **Mock GitHub Pages demo:** `https://abhidya.github.io/WorldPrize/`
- **Real Mini App URL:** set this to your deployed Vercel or Cloudflare URL in the World Developer Portal

## Quick start

```bash
pnpm install
pnpm dev
```

Then open the demo app from `apps/demo`.

## Environment

Copy `.env.example` to the demo app environment file and set your secrets there.

Required Vercel env:

- `NEXT_PUBLIC_WORLD_APP_ID=app_25d16ee7904752aca5fef279f2fe11c7`
- `WORLD_RP_ID=rp_3d1c7269a4c866a7`
- `WORLD_ACTION_FREE_ENTRY=worldprize-free-entry-demo`
- `WORLDPRIZE_MODE=mock`
- `NEXT_PUBLIC_WORLDPRIZE_MODE=mock`

Optional/future real mode:

- `WORLD_SIGNING_KEY=<server-only secret>`

`WORLD_SIGNING_KEY` must never be exposed client-side.

`WORLDPRIZE_MODE=mock` and `NEXT_PUBLIC_WORLDPRIZE_MODE=mock` keep the current Vercel demo mock-first with local mock humans and in-memory state. `WORLDPRIZE_MODE=real` activates the real World ID v4 verification flow: the backend signs RP context with `WORLD_SIGNING_KEY`, forwards the IDKit proof to the World verifier endpoint, and stores the returned nullifier to enforce one-verified-human-per-day.

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

## Real World ID v4 flow

When `WORLDPRIZE_MODE=real`, the free-entry path uses real World ID verification:

1. The frontend requests a server-signed RP context from `/api/world/sign`.
2. The app opens the World App / IDKit verification flow with:
   - `app_id = app_25d16ee7904752aca5fef279f2fe11c7`
   - `rp_id = rp_3d1c7269a4c866a7`
   - `action = worldprize-free-entry-demo`
   - `rp_context =` the server-signed context
3. IDKit returns the verification result to the app.
4. The app sends that result to `/api/enter`.
5. `/api/enter` forwards the IDKit payload to the World verifier endpoint (`POST https://developer.world.org/api/v4/verify/${WORLD_RP_ID}`).
6. The backend extracts the verified nullifier and stores it as a campaign-day entry.
7. Duplicate entries from the same nullifier on the same day are blocked.

The client never fabricates proof data and never sees `WORLD_SIGNING_KEY`. Outside World App, the free-entry button is disabled with a message to open in World App. The product-code path remains usable regardless of mode. GitHub Pages remains mock-only because it has no backend verification path.

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
