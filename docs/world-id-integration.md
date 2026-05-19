# World ID integration

WorldPrize uses World ID as a privacy-preserving anti-abuse gate for the free-entry path.

## What gets verified

- The user is treated as a unique human for the campaign/day.
- The backend stores a campaign/day nullifier hash.
- Repeated free-entry attempts from the same human/day are blocked.

## Design rules

- Do not trust client-only verification.
- Verify on the server or serverless backend.
- Store the nullifier server-side.
- Never show the full nullifier hash publicly.

## Helper shape

The World ID adapter exposes:

- `VerificationProvider`
- `MockWorldIdVerificationProvider`
- `WorldIdVerificationProvider`
- `createFreeEntryAction(campaignId, dayKey)`

## Demo mode vs real mode

- **Demo mode:** local proof stubs and in-memory state
- **Real mode:** server-side verification, signing, and nullifier persistence

