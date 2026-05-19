# WorldPrize architecture

WorldPrize is split into four layers:

```text
packages/core          generic promotion engine
packages/world-id      World ID verification adapter and action helpers
packages/storage-memory in-memory demo storage and audit/state logic
apps/demo              Next.js UI, API routes, and demo choreography
```

## Runtime modes

- **Mock mode (`WORLDPRIZE_MODE=mock`):** supports the interview demo, local development, and GitHub Pages. It uses mock humans and in-memory state.
- **Real mode (`WORLDPRIZE_MODE=real`):** requires a deployed app with backend/serverless API routes. It uses World ID v4 verification, server-side signing, and nullifier storage.

GitHub Pages is mock-only because it cannot run the World verification backend.

## Core flow

1. A user chooses either:
   - product code entry
   - free daily entry protected by World ID
2. The demo app submits the request to the API layer.
3. `@worldprize/core` applies the promotion rules:
   - validate product codes
   - verify free-entry uniqueness
   - evaluate random odds
   - honor the maximum winner cap
4. `@worldprize/storage-memory` updates the campaign state atomically:
   - code usage
   - nullifier uniqueness
   - prize inventory
   - audit events
   - admin stats
5. The public audit page shows masked identifiers only.

## Why this split matters

- `core` stays free of World-specific code.
- `world-id` can be swapped for a real server-side verifier later.
- `storage-memory` gives the demo a local, no-infrastructure state layer.
- `apps/demo` stays focused on user experience and interview storytelling.

## World ID responsibilities

- `packages/world-id` owns the server-side verification shape and action helpers.
- The frontend only asks for a signed RP context and hands the IDKit result back to the backend.
- The backend never trusts client-only proof data in real mode.

## Production-adjacent note

The demo uses in-memory storage for local development. A production adapter would need transaction semantics and database constraints such as:

- `UNIQUE(campaign_id, product_code)`
- `UNIQUE(campaign_id, day_key, nullifier_hash)`
- `CHECK(quantity_remaining >= 0)`

It would also need a transaction boundary around:

1. proof verification
2. nullifier insertion
3. instant-win evaluation
4. prize reservation
5. audit event write
