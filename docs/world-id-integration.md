# World ID integration

WorldPrize uses World ID as a privacy-preserving anti-abuse gate for the free-entry path.

## Runtime modes

- `WORLDPRIZE_MODE=mock` keeps the current interview demo behavior:
  - mock humans such as Alice, Bob, and Charlie work
  - bot/no-proof attempts are rejected
  - no real IDKit verification is required
- `WORLDPRIZE_MODE=real` switches the free-entry path to the server-side World ID v4 integration:
  - the user must pass through the World App / IDKit flow
  - the backend signs the request
  - the backend verifies the result
  - the backend stores the nullifier server-side

GitHub Pages should remain mock-only. The real flow needs a backend or serverless deployment.

## What gets verified

- The user is treated as a unique human for the campaign/day.
- The backend stores a campaign/day nullifier hash.
- Repeated free-entry attempts from the same human/day are blocked.

## Design rules

- Do not trust client-only verification. The `WorldIdVerificationProvider` always forwards the proof payload to the World verifier endpoint — it never accepts a client-side `{ verified: true }` claim.
- Verify on the server or serverless backend.
- Store the nullifier server-side.
- Never show the full nullifier hash publicly.
- `/api/enter` in real mode verifies the IDKit proof before allowing a free-entry campaign entry.
- Outside World App, the free-entry button is disabled — the product-code path remains usable.

## Helper shape

The World ID adapter exposes:

- `VerificationProvider`
- `MockWorldIdVerificationProvider`
- `WorldIdVerificationProvider`
- `createFreeEntryAction(campaignId, dayKey)`

## Real World ID v4 verification flow

The intended server-side flow is:

1. The frontend computes the action value. For WorldPrize, the action is `worldprize-free-entry-demo`.
2. The frontend requests a signed RP context from `/api/world/sign`.
3. `/api/world/sign` uses the server-only `WORLD_SIGNING_KEY` and `signRequest` from `@worldcoin/idkit-core/signing` to produce the request context.
   The response should be treated as RP context metadata, not as a proof, and it should carry the expected signature fields such as `sig`, `nonce`, `created_at`, and `expires_at`.
4. The frontend opens the World App / IDKit flow with:
   - `app_id = app_25d16ee7904752aca5fef279f2fe11c7`
   - `rp_id = rp_3d1c7269a4c866a7`
   - `action = worldprize-free-entry-demo`
   - `rp_context =` the server-signed context
5. IDKit returns the verification payload to the app.
6. The app sends that payload to `/api/world/verify` or directly to `/api/enter`.
7. The backend forwards the payload as-is to the World verification endpoint:
   `https://developer.world.org/api/v4/verify/rp_3d1c7269a4c866a7`
8. The backend extracts the verified nullifier and stores it server-side.

Do not mutate, remap, or fabricate the proof payload in real mode. The client should never see `WORLD_SIGNING_KEY`, and the public UI should only expose a masked nullifier.

## Demo mode vs real mode

- **Demo mode:** local mock humans and in-memory state
- **Real mode:** server-side verification, signing, and nullifier persistence

## Production storage TODO

In-memory storage resets on redeployment. For production:

- Use persistent storage (Postgres, Redis, or equivalent) for `freeNullifiers` and `usedCodes`
- Add TTL or cleanup for stale nullifiers beyond the campaign window
- Consider rate-limiting on `/api/world/sign` and `/api/enter` to prevent abuse
