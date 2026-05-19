You’re right. The right answer is not “fork a raffle app” and not “build ePrize.” The right artifact is a **small, researched World ID reference integration** for a very specific promotions pain point:

> **WorldPrize: a reusable World ID-protected AMOE/free-entry module for instant-win product promotions, plus a polished demo app.**

Below is the full package: architecture, deliverables, demo script, documentation plan, agent prompt, and fine-grained task list.

---

# 1. Researched product thesis

Consumer brands run instant-win promotions to drive engagement: buy a product, find a code under the cap or inside packaging, enter the code, and instantly see whether you won merch, coupons, gift cards, or a grand prize. Commercial instant-win platforms commonly support mechanics like **random odds**, **unique codes**, and **random winning times**. ViralSweep’s instant-win setup docs list exactly those three prize-selection methods: random odds, unique codes, and random times. ([support.viralsweep.com][1])

The legal/product issue is that chance-based promotions with prizes generally cannot require purchase as the only way to enter. Realtime Media explains that promotions with a prize, including sweepstakes and instant-win games, cannot require purchase unless there is another way to enter; it also specifically says purchase-related actions like package codes or receipt validation need an **AMOE**, an alternative free method of entry. ([rtm.com][2])

That AMOE/free-entry route is the weak point. Product-code entries have natural friction because the consumer bought something. Free online entries can be attacked with scripts, fake emails, repeated accounts, and entry farms. Existing promo vendors handle that with a mix of spam filters, legal rules, manual review, email/phone checks, IP/device heuristics, and litigation risk.

**WorldPrize’s insight:** use World ID only where it is strongest: making the free-entry path **one verified human per campaign/day** without collecting invasive identity data. World ID has an “Action” primitive for putting an app operation behind a unique-human gate, and its nullifier is unique to the user, app, and action. ([World Developer Docs][3]) IDKit’s integration flow says the user’s World App generates a zero-knowledge proof, and the backend verifies the proof and stores a per-app/per-action nullifier to prevent the same person from verifying twice. ([World Developer Docs][4])

So the interview pitch is:

> “I built a small reference integration showing how World ID can protect the legally required no-purchase/free-entry path in instant-win product promotions. Product-code entries still work, but the free daily entry requires proof of human, so bots can’t farm the AMOE route.”

---

# 2. Correct final deliverable

The code agent should produce a **monorepo**, not a SaaS and not a generic raffle clone.

```text
worldprize/
  packages/
    core/                 reusable promotion engine
    world-id/             World ID verification adapter
    storage-memory/       demo/local storage adapter
  apps/
    demo/                 small Next.js demo / World Mini App-compatible app
  docs/
    interview-demo-script.md
    world-id-integration.md
    commercial-feature-map.md
    legal-limitations.md
    architecture.md
```

The repo has two purposes:

1. **Library/reference integration**
   A reusable TypeScript package showing how to model product-code entries, free-entry World ID nullifiers, instant-win results, prize inventory, audit events, and admin stats.

2. **Demo app**
   A small website/Mini App showing the exact CPG promotion use case: “I have a product code” vs “No purchase? Free daily entry with World ID.”

The demo can have a static/mock mode for GitHub Pages, but **real World ID mode needs backend/serverless verification**. World’s Mini App FAQ says MiniKit is a communication channel and you should never rely solely on client-side validation; World ID verification, Pay, and Wallet Auth should be verified on your backend. ([World Developer Docs][5])

So the hosting story should be:

```text
GitHub Pages: mock/static demo only
Vercel: real demo with API routes
Cloudflare Pages + Functions: real demo option
Netlify Functions: real demo option
```

---

# 3. Architecture

## 3.1 High-level flow

```text
Participant opens campaign
  ↓
Chooses entry method

A) Product-code path
  enter package code
  backend validates code unused
  instant-win engine runs
  entry + audit event saved

B) Free AMOE path
  World ID / mock proof requested
  backend verifies proof
  backend derives/stores campaign/day nullifier
  duplicate nullifier rejected
  instant-win engine runs
  entry + audit event saved
```

## 3.2 Core architecture diagram

```text
apps/demo UI
  ├─ Campaign landing page
  ├─ Product code form
  ├─ Free World ID entry button
  ├─ Result card
  ├─ Admin dashboard
  └─ Public audit page

/api/enter
  ↓
@worldprize/core
  ├─ campaign rules
  ├─ product code validation
  ├─ free entry uniqueness rules
  ├─ instant win engine
  ├─ prize inventory
  ├─ audit events
  └─ admin stats

VerificationProvider
  ├─ MockWorldIdProvider
  └─ WorldIdProvider

StorageAdapter
  ├─ MemoryStorage for demo
  ├─ Supabase/Postgres later
  └─ Cloudflare KV/D1 later
```

## 3.3 Why the adapter split matters

`@worldprize/core` should not know about World SDK specifics. It should only know that a free-entry verification provider returns:

```ts
type VerificationResult = {
  ok: boolean;
  nullifierHash?: string;
  reason?: "INVALID_PROOF" | "MISSING_PROOF" | "SERVER_ERROR";
};
```

That makes the repo a clean reference integration instead of a hardcoded demo.

---

# 4. Package design

## 4.1 `@worldprize/core`

Purpose: generic instant-win promotion logic.

Responsibilities:

```text
campaign config
product code validation
free-entry uniqueness rules
instant-win random odds
prize inventory
entry ledger
duplicate attempt logging
audit events
admin stats
CSV export data shape
```

Core API:

```ts
import { createWorldPrizeEngine } from "@worldprize/core";

const engine = createWorldPrizeEngine({
  campaign,
  storage,
  verificationProvider,
  clock,
  rng,
});

const result = await engine.enter({
  campaignId: "snack-drop-2026",
  method: "free_world_id",
  proofPayload,
});
```

Supported entry methods:

```ts
type EntryMethod = "product_code" | "free_world_id";
```

Supported results:

```ts
type EntryResultStatus =
  | "WIN"
  | "LOSE"
  | "ALREADY_ENTERED"
  | "INVALID_CODE"
  | "CODE_USED"
  | "CAMPAIGN_NOT_ACTIVE"
  | "PRIZES_EXHAUSTED"
  | "INVALID_PROOF";
```

## 4.2 `@worldprize/world-id`

Purpose: World-specific verification adapter.

Responsibilities:

```text
accept proof payload from frontend
verify proof server-side
return nullifier hash
never expose secrets client-side
support action naming strategy for campaign/day
include mock provider for local demo
```

Important: World ID actions should be scoped to the promotion rule. For “one free entry per day,” use a daily action/signal strategy such as:

```text
worldprize:snack-drop-2026:free-entry:2026-05-19
```

or use a stable action with a tamper-bound signal/day, depending on the exact World ID implementation you choose. The core product rule is that the stored nullifier uniqueness key must include:

```text
campaign_id + day_key + nullifier_hash
```

## 4.3 `apps/demo`

Purpose: interview demo.

Pages:

```text
/             Campaign page
/admin        Admin dashboard
/audit        Public audit page
/api/enter    Main server-side entry endpoint
/api/stats    Admin stats endpoint
```

Screens:

```text
Campaign landing page
Product-code entry form
Free-entry World ID flow
Result: win
Result: lose
Result: already used today
Result: invalid/reused code
Admin dashboard
Abuse simulator
Public audit page
Setup/missing-env notice
```

---

# 5. Data model

## 5.1 TypeScript types

```ts
export type Campaign = {
  id: string;
  title: string;
  brandName: string;
  description: string;
  startAt: string;
  endAt: string;
  prizeSummary: string;
  freeEntryRule: {
    cadence: "daily" | "once_per_campaign";
    provider: "mock_world_id" | "world_id";
  };
  instantWin: {
    mode: "random_odds";
    numerator: number;
    denominator: number;
    maxWinners: number;
  };
  legal: {
    noPurchaseNecessaryText: string;
    eligibilityText: string;
    disclaimer: string;
  };
};

export type ProductCode = {
  code: string;
  campaignId: string;
  status: "unused" | "used";
  usedByEntryId?: string;
  usedAt?: string;
};

export type Entry = {
  id: string;
  campaignId: string;
  method: "product_code" | "free_world_id";
  dayKey?: string;
  nullifierHash?: string;
  productCode?: string;
  result: "WIN" | "LOSE";
  prizeId?: string;
  createdAt: string;
};

export type DuplicateAttempt = {
  id: string;
  campaignId: string;
  dayKey: string;
  nullifierHash: string;
  createdAt: string;
};

export type Prize = {
  id: string;
  campaignId: string;
  label: string;
  type: "manual_merch" | "manual_crypto" | "coupon_code";
  quantityTotal: number;
  quantityRemaining: number;
  claimInstructions: string;
};

export type AuditEvent = {
  id: string;
  campaignId: string;
  type:
    | "CAMPAIGN_VIEWED"
    | "PRODUCT_CODE_ACCEPTED"
    | "PRODUCT_CODE_REJECTED"
    | "FREE_ENTRY_VERIFIED"
    | "DUPLICATE_FREE_ENTRY_BLOCKED"
    | "INSTANT_WIN_PLAYED"
    | "PRIZE_RESERVED";
  publicMessage: string;
  createdAt: string;
};
```

## 5.2 Production database constraints

For the demo, memory storage is fine. But the architecture should document the real constraints:

```sql
unique(campaign_id, product_code)
unique(campaign_id, day_key, nullifier_hash)
check(quantity_remaining >= 0)
```

The single most important engineering rule:

```text
Product-code use, nullifier insertion, win decision, and prize reservation must be atomic.
```

Without that, concurrent requests can reuse codes, double-enter, or over-award prizes.

---

# 6. Demo mechanics

## 6.1 Campaign

```text
Brand: SnackCo
Campaign: Snack Drop 2026
Prize: Win limited-edition merch or 25 USDC
Mechanic: Instant win
Paid/product path: enter package code
Free path: one free daily play with World ID
```

## 6.2 Valid mock product codes

```text
SNACK-123
SNACK-456
SNACK-789
```

## 6.3 Mock World ID humans

```text
Alice
Bob
Charlie
Bot/no-proof
```

Mock behavior:

```text
Alice first free entry today → accepted
Alice second free entry today → ALREADY_ENTERED
Bob first free entry today → accepted
Bot/no-proof → INVALID_PROOF
```

## 6.4 Instant-win engine

Implement only **random odds** first.

Commercial accuracy: random odds and winning moments/random times are standard instant-win allocation methods. ViralSweep supports random odds, unique codes, and random times; Realtime Media also describes instant-win promotions as using predetermined winning moments or odds-based allocation. ([support.viralsweep.com][1])

For this POC:

```ts
instantWin: {
  mode: "random_odds",
  numerator: 1,
  denominator: 5,
  maxWinners: 3
}
```

Seeded winning moments can be a documented stretch, not required.

---

# 7. User-facing demo flow

## Flow A: product-code entry

```text
1. User opens campaign page.
2. Clicks “I have a product code.”
3. Enters SNACK-123.
4. Backend marks code used.
5. Instant-win engine runs.
6. User sees WIN or LOSE.
7. Reusing SNACK-123 shows CODE_USED.
```

## Flow B: free daily entry

```text
1. User clicks “No purchase? Free daily entry.”
2. In demo mode, selects Alice.
3. Backend receives mock proof/nullifier.
4. Backend checks unique(campaign_id, day_key, nullifier_hash).
5. First Alice attempt accepted.
6. Alice tries again.
7. Backend blocks duplicate.
8. Bob tries.
9. Bob accepted.
```

## Abuse simulator

Buttons:

```text
Simulate Alice trying 5 times
Simulate 100 fake free-entry bot attempts
Simulate product code reuse
```

Expected output:

```text
Alice simulation:
1 accepted, 4 blocked

Bot simulation:
0 accepted, 100 rejected for missing proof

Code reuse:
1 accepted, 1 rejected
```

This is the demo’s “aha.”

---

# 8. Admin dashboard

Show:

```text
Campaign status
Product-code entries
Free World ID entries
Duplicate free-entry attempts blocked
Invalid/reused product-code attempts
Winners
Prize inventory remaining
Recent audit events
Export JSON/CSV button
```

Do not expose full nullifier hashes in the UI.

Public audit page should show:

```text
Total entries
Free verified entries
Duplicate attempts blocked
Winner count
Prize inventory remaining
Masked entry IDs
Campaign config hash
```

---

# 9. What not to build

Do **not** build:

```text
full ePrize clone
multi-tenant SaaS
brand account system
visual campaign builder
tax forms
official rules generator
legal compliance engine
physical fulfillment
receipt OCR
email/SMS marketing
referral system
real escrow/payout
onchain randomness
random OSS fork
```

Payment/crypto should be optional language only. If mentioned in code, use a stub:

```ts
type PayoutMode = "manual" | "coupon_code" | "world_chain_stub";
```

World’s Pay docs say payments should be verified on the backend before being treated as final, so real payout support should not be thrown into the POC casually. ([World Developer Docs][6])

---

# 10. Documentation deliverables

## `README.md`

Must include:

```text
What WorldPrize is
What it is not
Why AMOE/free-entry is the use case
How World ID nullifiers map to one-human-one-day
How to run demo mode
How to deploy real mode
Screenshots/GIF placeholders
```

Opening:

```text
WorldPrize is a small open-source reference integration for World ID-protected free-entry flows in instant-win product promotions. It demonstrates how brands can keep product-code promotions while making the legally required no-purchase/free-entry route resistant to duplicate-human and bot abuse.
```

## `docs/architecture.md`

Include:

```text
system diagram
package responsibilities
entry flow
data model
atomicity requirements
security boundaries
```

## `docs/world-id-integration.md`

Include:

```text
why proof verification belongs on backend
what a nullifier is
campaign/day action strategy
mock mode vs real mode
environment variables
```

## `docs/commercial-feature-map.md`

Map:

```text
Commercial instant-win feature → WorldPrize POC
Product codes → implemented mock codes
Random odds → implemented
Random winning times → stretch
Unique prize codes → stretch
Free AMOE → implemented with World ID
Fraud filters → replaced/reduced for free path
Winner admin → implemented minimal dashboard
Legal admin → not implemented
Fulfillment → manual only
```

## `docs/legal-limitations.md`

Say clearly:

```text
WorldPrize is not legal advice.
World ID does not remove sweepstakes, contest, tax, age, regional, or consumer-protection obligations.
World ID only helps reduce duplicate-human abuse on the free-entry path.
```

This matters because no-purchase/AMOE law is part of the real product context. RTM’s legal guide explains that promotions with prizes can face strict legal scrutiny and purchase-required chance promotions can risk being illegal lotteries without a free method of entry. ([rtm.com][2])

## `docs/interview-demo-script.md`

Include the exact script below.

---

# 11. Interview demo script

## 30-second framing

> “I wanted to bring a small demo that shows where World ID has practical consumer-business value. Brands run instant-win product promotions: buy a product, enter a package code, maybe win merch. But because chance-based promotions need a no-purchase/free-entry route, that free route can be abused by bots and entry farms. WorldPrize shows how World ID can protect that free-entry path.”

## 2-minute demo

1. Open WorldPrize campaign page.

Say:

> “This is a fake SnackCo instant-win campaign. There are two paths: product code, and no-purchase free daily entry.”

2. Product-code path.

Say:

> “The product-code path models codes under caps or inside packaging. The code can only be used once.”

Enter:

```text
SNACK-123
```

Show result.

3. Reuse same code.

Say:

> “If someone posts a code online or tries to reuse it, it gets rejected.”

4. Free-entry path with Alice.

Say:

> “The free path is where World ID matters. In real mode, this would request a World ID proof. In demo mode, Alice is a mock verified human.”

Select Alice. Show accepted.

5. Alice again.

Say:

> “Same human, same campaign, same day: blocked. That is the nullifier use case.”

6. Bob.

Say:

> “Different human: accepted. We are not blocking people; we are blocking duplicate-human farming.”

7. Abuse simulator.

Run:

```text
Simulate Alice trying 5 times
Simulate 100 bot attempts
```

Say:

> “This is the point. The AMOE route remains free and accessible, but not infinitely farmable.”

8. Admin dashboard.

Show:

```text
Product-code entries
Free verified entries
Duplicates blocked
Invalid codes
Winners
Prizes remaining
```

9. Close with limitation.

Say:

> “This is not a legal compliance engine and not a full ePrize replacement. It is a reference integration for the one piece World ID is uniquely good at: one-human-one-action on the free-entry route.”

## 15-second closing line

> “WorldPrize turns World ID into a drop-in anti-Sybil adapter for consumer promotions. It does not replace sweepstakes law, but it can reduce the abuse and verification burden that made these campaigns expensive.”

---

# 12. Full coding-agent prompt

Use this as the agent prompt:

```text
Build WorldPrize, a small open-source monorepo demonstrating World ID-protected AMOE/free-entry flows for instant-win product promotions.

This is an interview demo and reference integration, not a full SaaS product and not an ePrize clone.

Product context:
Consumer brands run instant-win promotions where customers buy a product, find a package code, enter the code, and instantly see whether they won merch, coupons, gift cards, or a digital reward. Because chance-based purchase promotions generally need a no-purchase/free method of entry, the free-entry path can be abused by scripts, fake emails, entry farms, and repeated accounts.

WorldPrize demonstrates how World ID can protect that free-entry path. The product-code path remains available, but the no-purchase/free daily entry path requires World ID verification. The backend stores a campaign/day nullifier so one verified human can only use the free route once per day.

Deliver a monorepo:

worldprize/
  packages/
    core/
    world-id/
    storage-memory/
  apps/
    demo/
  docs/

Core deliverables:
1. @worldprize/core
   - generic promotion engine
   - campaign config
   - product-code validation
   - free-entry uniqueness rule
   - instant-win random odds engine
   - prize inventory
   - audit events
   - admin stats
   - no World-specific code inside core

2. @worldprize/world-id
   - VerificationProvider interface
   - MockWorldIdVerificationProvider
   - WorldIdVerificationProvider adapter/stub
   - real provider must be designed for server-side proof verification
   - return nullifierHash on success
   - never expose secrets client-side

3. @worldprize/storage-memory
   - MemoryStorage adapter for local demo
   - enforce uniqueness:
     - product code used once
     - free entry unique by campaign_id + day_key + nullifier_hash
   - prevent prize inventory from going below zero

4. apps/demo
   - Next.js + TypeScript
   - mobile-first UI
   - campaign landing page
   - product-code entry form
   - free World ID entry flow
   - mock mode for demo outside World App
   - result cards
   - admin dashboard
   - abuse simulation panel
   - public audit page
   - API route /api/enter
   - API route /api/admin/stats
   - no paid infrastructure required for local demo

Campaign:
Brand: SnackCo
Campaign: Snack Drop 2026
Prize: limited-edition merch or 25 USDC
Entry methods:
A. I have a product code
B. No purchase? Free daily entry with World ID

Valid demo product codes:
SNACK-123
SNACK-456
SNACK-789

Mock humans:
Alice
Bob
Charlie
Bot/no-proof

Expected behavior:
- SNACK-123 works once.
- Reusing SNACK-123 returns CODE_USED.
- Invalid code returns INVALID_CODE.
- Alice free entry works once today.
- Alice second free entry today returns ALREADY_ENTERED.
- Bob free entry works separately.
- Bot/no-proof returns INVALID_PROOF.
- Random odds can return WIN or LOSE.
- Prize inventory never goes below zero.
- Admin dashboard updates counts.
- Public audit page masks nullifiers.

Instant-win engine:
Implement random odds only for MVP.
Support:
- numerator
- denominator
- maxWinners
- injected RNG for tests
- atomic prize reservation behavior in storage layer

Result statuses:
WIN
LOSE
ALREADY_ENTERED
INVALID_CODE
CODE_USED
CAMPAIGN_NOT_ACTIVE
PRIZES_EXHAUSTED
INVALID_PROOF

Security and correctness:
- Do not trust client-only verification.
- Real World ID mode must be structured around backend/serverless verification.
- Store nullifier server-side.
- Never expose full nullifier hashes publicly.
- Admin can see masked nullifier only.
- Product-code use, nullifier insertion, win decision, and prize reservation should be one atomic operation at the storage/engine boundary.
- Add comments/TODOs explaining what a real Postgres/Supabase adapter would need:
  UNIQUE(campaign_id, day_key, nullifier_hash)
  UNIQUE(campaign_id, product_code)
  CHECK(quantity_remaining >= 0)
  transaction around entry + prize reservation

UI:
- Clean polished demo, not debug-looking.
- Campaign landing page has two large entry cards:
  1. I have a product code
  2. No purchase? Free daily entry with World ID
- Add visible compliance disclaimer:
  “Demo only. Promotion laws, eligibility, tax, age, regional restrictions, and no-purchase requirements still apply. World ID only helps reduce duplicate-human abuse on the free-entry path.”
- Abuse simulator must be labeled demo-only.

Docs:
Create:
- README.md
- docs/architecture.md
- docs/world-id-integration.md
- docs/commercial-feature-map.md
- docs/legal-limitations.md
- docs/interview-demo-script.md

README must explain:
- What WorldPrize is
- What it is not
- Why AMOE/free-entry is the use case
- How World ID nullifiers map to one-human-one-day
- How to run local mock mode
- Why GitHub Pages is mock-only
- Why Vercel/Cloudflare Functions are needed for real World ID mode
- How to present the demo in an interview

Tests:
Use Vitest.
Minimum tests:
1. valid product code can enter once
2. product code cannot be reused
3. invalid product code rejected
4. Alice free entry accepted once
5. Alice duplicate blocked same day
6. Bob accepted same day
7. bot/no-proof rejected
8. random odds win with injected RNG
9. random odds lose with injected RNG
10. maxWinners enforced
11. prize inventory cannot go below zero
12. public audit masks nullifier
13. admin stats count duplicate attempts

Do not build:
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

Definition of done:
- pnpm install works
- pnpm test passes
- pnpm dev runs demo locally
- demo can show product-code path, free-entry path, duplicate blocking, abuse simulation, admin stats, and audit page
- docs include interview demo script
- code is cleanly separated into core, world-id adapter, storage, and demo app
```

---

# 13. Fine-grained implementation tasks

## Phase 0 — repo scaffold

1. Create pnpm monorepo.
2. Add TypeScript config.
3. Add Vitest.
4. Add ESLint/Prettier only if fast.
5. Create package folders:

   ```text
   packages/core
   packages/world-id
   packages/storage-memory
   apps/demo
   docs
   ```

Acceptance:

```text
pnpm install
pnpm test
pnpm build
```

---

## Phase 1 — core types

Create:

```text
packages/core/src/types.ts
```

Define:

```text
Campaign
ProductCode
Entry
DuplicateAttempt
Prize
AuditEvent
EntryRequest
EntryResponse
AdminStats
StorageAdapter
VerificationProvider
```

Acceptance:

```text
types compile
no UI yet
```

---

## Phase 2 — memory storage

Create:

```text
packages/storage-memory/src/MemoryStorage.ts
```

Implement:

```text
getCampaign
useProductCodeOnce
hasFreeEntryNullifier
recordFreeEntryNullifier
saveEntry
saveDuplicateAttempt
reservePrize
listEntries
listDuplicateAttempts
listAuditEvents
getAdminStats
```

Important behavior:

```text
product codes are one-use
free nullifier unique by campaign + day + nullifier
prize quantity cannot go negative
```

Acceptance tests:

```text
product code reused → rejected
duplicate nullifier → rejected
prize inventory enforced
```

---

## Phase 3 — instant-win engine

Create:

```text
packages/core/src/instantWin.ts
```

Implement:

```text
evaluateRandomOdds({ numerator, denominator, rng })
```

Use injected RNG for tests.

Acceptance tests:

```text
rng 0.0 with 1/5 odds → WIN
rng 0.9 with 1/5 odds → LOSE
max winners enforced via storage
```

---

## Phase 4 — entry engine

Create:

```text
packages/core/src/engine.ts
```

Implement:

```ts
engine.enter(request)
```

Logic:

```text
check campaign active
if product_code:
  use product code once
if free_world_id:
  verify proof
  compute dayKey
  check/insert nullifier
run instant win
reserve prize if win
save entry
append audit events
return result
```

Acceptance tests:

```text
all core result states tested
```

---

## Phase 5 — mock World ID provider

Create:

```text
packages/world-id/src/MockWorldIdVerificationProvider.ts
```

Behavior:

```text
Alice → hash(mock:alice)
Bob → hash(mock:bob)
Charlie → hash(mock:charlie)
Bot/no-proof → invalid proof
```

Acceptance:

```text
same mock human gives same nullifier
different humans give different nullifiers
bot rejected
```

---

## Phase 6 — World ID provider stub

Create:

```text
packages/world-id/src/WorldIdVerificationProvider.ts
```

Do not fake real security. Implement the interface and structure, with clear TODO/env requirements:

```text
app/rp id
action
server-side verification method
return nullifier hash
```

Acceptance:

```text
compiles
docs explain real setup
demo defaults to mock mode
```

---

## Phase 7 — Next.js demo

Create:

```text
apps/demo
```

Pages:

```text
/
 /admin
 /audit
```

Components:

```text
CampaignHero
EntryOptions
ProductCodeForm
FreeEntryCard
ResultCard
AdminDashboard
AbuseSimulator
AuditTimeline
ComplianceDisclaimer
```

Acceptance:

```text
page looks polished
mobile-first
demo works without external services
```

---

## Phase 8 — API routes

Create:

```text
apps/demo/app/api/enter/route.ts
apps/demo/app/api/admin/stats/route.ts
```

`POST /api/enter` handles:

```text
product_code entry
free_world_id entry
mockHumanId
```

Acceptance:

```text
UI calls API
state persists for current server process
```

---

## Phase 9 — abuse simulator

Add buttons:

```text
Simulate Alice trying 5 times
Simulate 100 fake bot attempts
Simulate code reuse
Reset demo state
```

Acceptance:

```text
visible counts change
dashboard reflects attempts
```

---

## Phase 10 — admin dashboard

Display:

```text
product-code entries
free World ID entries
duplicate free attempts blocked
invalid/reused code attempts
winners
prize inventory remaining
recent events
```

Acceptance:

```text
stats match engine state
```

---

## Phase 11 — audit page

Display:

```text
campaign status
entry counts
duplicate blocked count
winner count
masked entry IDs
campaign config hash
```

Acceptance:

```text
no full nullifier hash visible
```

---

## Phase 12 — docs

Write:

```text
README.md
docs/architecture.md
docs/world-id-integration.md
docs/commercial-feature-map.md
docs/legal-limitations.md
docs/interview-demo-script.md
```

Acceptance:

```text
someone can run demo
someone can understand interview pitch
limitations are explicit
```

---

# 14. Final interview framing

Do not say:

> “I built an ePrize replacement.”

Say:

> “I built a small World ID reference integration for one painful part of ePrize-style promotions: the no-purchase/free-entry path.”

Do not say:

> “This solves sweepstakes law.”

Say:

> “This does not replace legal compliance. It makes the free-entry path harder to farm while preserving privacy.”

Do not say:

> “Companies can host it with no infrastructure.”

Say:

> “The mock demo can run statically, but real World ID mode needs a serverless verification endpoint. There is no central WorldPrize-hosted service.”

The tightest final pitch:

> “WorldPrize shows how World ID can make AMOE/free-entry routes in instant-win product promotions Sybil-resistant. Product codes still drive purchase engagement, but the legally required free path becomes one verified human per day instead of an unlimited bot target.”

[1]: https://support.viralsweep.com/en/articles/9272702-instant-win-setup "Instant Win Setup | ViralSweep Support Center"
[2]: https://www.rtm.com/blog/no-purchase-necessary-laws-and-your-sweepstakes "No Purchase Necessary Laws and Your Sweepstakes"
[3]: https://docs.world.org/world-id/concepts "World Developer Docs"
[4]: https://docs.world.org/world-id/idkit/integrate "World Developer Docs"
[5]: https://docs.world.org/mini-apps/more/faq?utm_source=chatgpt.com "FAQ - World Developer Docs"
[6]: https://docs.world.org/mini-apps/commands/pay?utm_source=chatgpt.com "Pay - World Developer Docs"
