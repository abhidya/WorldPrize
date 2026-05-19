# WorldPrize architecture

WorldPrize is split into four layers:

```text
packages/core          generic promotion engine
packages/world-id      World ID verification adapter and action helpers
packages/storage-memory in-memory demo storage and audit/state logic
apps/demo              Next.js UI, API routes, and demo choreography
```

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

## Production-adjacent note

The demo uses in-memory storage for local development. A production adapter would need transaction semantics and database constraints such as:

- `UNIQUE(campaign_id, product_code)`
- `UNIQUE(campaign_id, day_key, nullifier_hash)`
- `CHECK(quantity_remaining >= 0)`

