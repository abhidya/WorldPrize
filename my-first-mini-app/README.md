# WorldPrize

WorldPrize is a small World ID reference integration for instant-win product promotions.

It demonstrates the exact interview-friendly pitch from `Design.md`:

- product-code entries still work
- the no-purchase/free-entry path is protected by a mock World ID proof
- duplicates are blocked per campaign day
- the public audit trail masks sensitive identifiers
- the admin dashboard shows campaign health and abuse simulations

## What this demo includes

- `app/` landing page with two entry paths
- `app/audit` public masked audit page
- server-backed mock state for entries, stats, inventory, and simulations
- simple route handlers for entry, stats, reset, and demo abuse scenarios

## Run locally

```bash
npm install
npm run dev
```

Then open the app in your browser at the local dev URL.

## Demo flow

1. Try a product code such as `TREAT-001`
2. Try the free-entry path with a human ID such as `dan`
3. Repeat the same human ID to see duplicate blocking
4. Use the abuse simulator buttons to show bot attempts and code reuse
5. Open `/audit` to see the public masked trail

## Notes

- This repo is intentionally a mock/demo integration, not a full promotions SaaS.
- The mock World ID flow is server-backed in-process state only.
- Real World ID verification would need a backend or serverless endpoint.
