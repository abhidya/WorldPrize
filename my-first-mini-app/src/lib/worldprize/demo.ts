import { createHash } from 'node:crypto';

export type EntryMethod = 'product_code' | 'free_world_id';

export type EntryStatus =
  | 'WIN'
  | 'LOSE'
  | 'ALREADY_ENTERED'
  | 'INVALID_CODE'
  | 'CODE_USED'
  | 'CAMPAIGN_NOT_ACTIVE'
  | 'PRIZES_EXHAUSTED'
  | 'INVALID_PROOF';

export type EntryRequest =
  | {
      method: 'product_code';
      code: string;
      source?: string;
    }
  | {
      method: 'free_world_id';
      humanId: string;
      proof?: string;
      source?: string;
    };

export interface CampaignInfo {
  id: string;
  name: string;
  tagline: string;
  status: 'ACTIVE' | 'PAUSED';
  active: boolean;
  mockMode: 'static-demo' | 'serverless-demo';
  validCodes: string[];
  freeEntryRule: string;
  configHash: string;
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  method: EntryMethod;
  status: EntryStatus;
  actorMasked: string;
  inputMasked: string;
  prize?: string;
  note: string;
}

export interface DemoStats {
  campaignActive: boolean;
  productCodeEntries: number;
  freeWorldIdEntries: number;
  duplicateFreeAttempts: number;
  invalidOrReusedCodes: number;
  invalidProofAttempts: number;
  winners: number;
  prizesRemaining: number;
  campaignConfigHash: string;
  inventory: Record<string, number>;
  recentEvents: AuditEntry[];
}

export interface CampaignSnapshot {
  campaign: CampaignInfo;
  stats: DemoStats;
  audit: AuditEntry[];
}

export interface EntryResponse {
  success: boolean;
  result: {
    method: EntryMethod;
    status: EntryStatus;
    headline: string;
    detail: string;
    actorMasked: string;
    inputMasked: string;
    prize?: string;
  };
  stats: DemoStats;
}

export interface SimulationResponse {
  scenario: 'alice-five' | 'bots-100' | 'reuse-code';
  results: EntryResponse[];
  stats: DemoStats;
}

type InternalState = {
  nextId: number;
  productCodeEntries: number;
  freeWorldIdEntries: number;
  duplicateFreeAttempts: number;
  invalidOrReusedCodes: number;
  invalidProofAttempts: number;
  winners: number;
  usedCodes: Set<string>;
  freeNullifiers: Set<string>;
  prizeInventory: string[];
  events: AuditEntry[];
};

const campaign = {
  id: 'snack-drop-2026',
  name: 'WorldPrize Snack Drop',
  tagline:
    'A reusable World ID reference integration for instant-win product promotions.',
  status: 'ACTIVE',
  active: true,
  mockMode: 'static-demo',
  validCodes: ['TREAT-001', 'SNACK-123', 'WORLD-404', 'COCOA-101'],
  freeEntryRule: 'One verified human per campaign day',
} as const satisfies Omit<CampaignInfo, 'configHash'>;

const initialPrizeInventory = [
  'Mini hoodie',
  'Coffee voucher',
  'Gift card',
  'Sticker pack',
  'Tote bag',
  'Shipping upgrade',
];

const configHash = hashText(
  JSON.stringify({
    campaignId: campaign.id,
    validCodes: campaign.validCodes,
    freeEntryRule: campaign.freeEntryRule,
    inventory: initialPrizeInventory,
  }),
).slice(0, 12);

const campaignInfo: CampaignInfo = {
  ...campaign,
  configHash,
};

const state: InternalState = createInitialState();

function createInitialState(): InternalState {
  return {
    nextId: 1,
    productCodeEntries: 0,
    freeWorldIdEntries: 0,
    duplicateFreeAttempts: 0,
    invalidOrReusedCodes: 0,
    invalidProofAttempts: 0,
    winners: 0,
    usedCodes: new Set<string>(),
    freeNullifiers: new Set<string>(),
    prizeInventory: [...initialPrizeInventory],
    events: [],
  };
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashToUnitInterval(value: string): number {
  const hex = hashText(value).slice(0, 12);
  const numerator = Number.parseInt(hex, 16);
  const denominator = 0xffffffffffff;
  return numerator / denominator;
}

function maskToken(value: string, front = 3, back = 3): string {
  if (value.length <= front + back + 1) {
    return value;
  }
  return `${value.slice(0, front)}…${value.slice(-back)}`;
}

function dayKeyFor(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeHumanId(humanId: string): string {
  return humanId.trim().toLowerCase();
}

function currentSnapshot(): CampaignSnapshot {
  const recentEvents = state.events.slice(0, 5);
  return {
    campaign: campaignInfo,
    stats: {
      campaignActive: campaignInfo.active,
      productCodeEntries: state.productCodeEntries,
      freeWorldIdEntries: state.freeWorldIdEntries,
      duplicateFreeAttempts: state.duplicateFreeAttempts,
      invalidOrReusedCodes: state.invalidOrReusedCodes,
      invalidProofAttempts: state.invalidProofAttempts,
      winners: state.winners,
      prizesRemaining: state.prizeInventory.length,
      campaignConfigHash: campaignInfo.configHash,
      inventory: state.prizeInventory.reduce<Record<string, number>>(
        (accumulator, prize) => {
          accumulator[prize] = (accumulator[prize] ?? 0) + 1;
          return accumulator;
        },
        {},
      ),
      recentEvents,
    },
    audit: [...state.events],
  };
}

function recordEvent(event: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
  const entry: AuditEntry = {
    id: state.nextId,
    timestamp: new Date().toISOString(),
    ...event,
  };
  state.nextId += 1;
  state.events.unshift(entry);
  return entry;
}

function resolvePrize(key: string): string | null {
  if (state.prizeInventory.length === 0) {
    return null;
  }

  const threshold = 0.64;
  const roll = hashToUnitInterval(key);
  if (roll >= threshold) {
    return null;
  }

  return state.prizeInventory.shift() ?? null;
}

function resultPayload(
  method: EntryMethod,
  status: EntryStatus,
  actorMasked: string,
  inputMasked: string,
  note: string,
  prize?: string,
): EntryResponse {
  return {
    success: status === 'WIN' || status === 'LOSE' || status === 'PRIZES_EXHAUSTED',
    result: {
      method,
      status,
      headline: headlineForStatus(status),
      detail: note,
      actorMasked,
      inputMasked,
      ...(prize ? { prize } : {}),
    },
    stats: currentSnapshot().stats,
  };
}

function headlineForStatus(status: EntryStatus): string {
  switch (status) {
    case 'WIN':
      return 'Winner';
    case 'LOSE':
      return 'Valid entry, no prize';
    case 'ALREADY_ENTERED':
      return 'Duplicate blocked';
    case 'INVALID_CODE':
      return 'Invalid code';
    case 'CODE_USED':
      return 'Code already used';
    case 'CAMPAIGN_NOT_ACTIVE':
      return 'Campaign paused';
    case 'PRIZES_EXHAUSTED':
      return 'Entry accepted, prizes exhausted';
    case 'INVALID_PROOF':
      return 'Proof rejected';
  }
}

function enterProductCode(code: string, source = 'web'): EntryResponse {
  if (!campaignInfo.active) {
    return resultPayload(
      'product_code',
      'CAMPAIGN_NOT_ACTIVE',
      'guest',
      maskToken(code.trim().toUpperCase()),
      `Campaign is paused for ${source} entries.`,
    );
  }

  const normalizedCode = normalizeCode(code);
  const actorMasked = 'guest';
  const inputMasked = maskToken(normalizedCode);

  if (!campaignInfo.validCodes.includes(normalizedCode)) {
    state.invalidOrReusedCodes += 1;
    recordEvent({
      method: 'product_code',
      status: 'INVALID_CODE',
      actorMasked,
      inputMasked,
      note: `Rejected invalid code from ${source}.`,
    });
    return resultPayload(
      'product_code',
      'INVALID_CODE',
      actorMasked,
      inputMasked,
      `Code ${inputMasked} is not in the campaign allow-list.`,
    );
  }

  if (state.usedCodes.has(normalizedCode)) {
    state.invalidOrReusedCodes += 1;
    recordEvent({
      method: 'product_code',
      status: 'CODE_USED',
      actorMasked,
      inputMasked,
      note: `Attempted reuse from ${source}.`,
    });
    return resultPayload(
      'product_code',
      'CODE_USED',
      actorMasked,
      inputMasked,
      `Code ${inputMasked} has already been redeemed.`,
    );
  }

  state.usedCodes.add(normalizedCode);
  state.productCodeEntries += 1;

  const prize = resolvePrize(`product_code:${normalizedCode}`);
  if (prize) {
    state.winners += 1;
    const note = `Product-code entry won ${prize}.`;
    recordEvent({
      method: 'product_code',
      status: 'WIN',
      actorMasked,
      inputMasked,
      prize,
      note,
    });
    return resultPayload(
      'product_code',
      'WIN',
      actorMasked,
      inputMasked,
      note,
      prize,
    );
  }

  const wouldHaveWon = hashToUnitInterval(`product_code:${normalizedCode}`) < 0.64;
  const status: EntryStatus = wouldHaveWon ? 'PRIZES_EXHAUSTED' : 'LOSE';
  const note =
    status === 'PRIZES_EXHAUSTED'
      ? 'The code qualified, but the prize pool is empty.'
      : 'Nice try — this code was valid, but it missed the prize threshold.';

  recordEvent({
    method: 'product_code',
    status,
    actorMasked,
    inputMasked,
    note,
  });
  return resultPayload('product_code', status, actorMasked, inputMasked, note);
}

function enterFreeWorldId(
  humanId: string,
  proof = '',
  source = 'web',
): EntryResponse {
  if (!campaignInfo.active) {
    return resultPayload(
      'free_world_id',
      'CAMPAIGN_NOT_ACTIVE',
      maskToken(normalizeHumanId(humanId)),
      'no-proof',
      `Campaign is paused for ${source} entries.`,
    );
  }

  const normalizedHumanId = normalizeHumanId(humanId);
  const actorMasked = maskToken(normalizedHumanId);
  const inputMasked = maskToken(normalizedHumanId);

  if (proof !== 'mock-world-id') {
    state.invalidProofAttempts += 1;
    recordEvent({
      method: 'free_world_id',
      status: 'INVALID_PROOF',
      actorMasked,
      inputMasked,
      note: `Rejected non-mock proof from ${source}.`,
    });
    return resultPayload(
      'free_world_id',
      'INVALID_PROOF',
      actorMasked,
      inputMasked,
      'Mock World ID proof was not provided.',
    );
  }

  const dayKey = dayKeyFor();
  const nullifier = hashText(
    `${campaignInfo.id}:${normalizedHumanId}:${dayKey}`,
  );

  if (state.freeNullifiers.has(nullifier)) {
    state.duplicateFreeAttempts += 1;
    recordEvent({
      method: 'free_world_id',
      status: 'ALREADY_ENTERED',
      actorMasked,
      inputMasked,
      note: `Duplicate free-entry attempt blocked for ${dayKey}.`,
    });
    return resultPayload(
      'free_world_id',
      'ALREADY_ENTERED',
      actorMasked,
      inputMasked,
      `One verified human per day: ${actorMasked} already entered on ${dayKey}.`,
    );
  }

  state.freeNullifiers.add(nullifier);
  state.freeWorldIdEntries += 1;

  const prize = resolvePrize(`free_world_id:${nullifier}`);
  if (prize) {
    state.winners += 1;
    const note = `Free World ID entry won ${prize}.`;
    recordEvent({
      method: 'free_world_id',
      status: 'WIN',
      actorMasked,
      inputMasked,
      prize,
      note,
    });
    return resultPayload(
      'free_world_id',
      'WIN',
      actorMasked,
      inputMasked,
      note,
      prize,
    );
  }

  const wouldHaveWon = hashToUnitInterval(`free_world_id:${nullifier}`) < 0.64;
  const status: EntryStatus = wouldHaveWon ? 'PRIZES_EXHAUSTED' : 'LOSE';
  const note =
    status === 'PRIZES_EXHAUSTED'
      ? 'The human check passed, but the prize pool is empty.'
      : 'Human check passed, but this entry did not hit the prize threshold.';

  recordEvent({
    method: 'free_world_id',
    status,
    actorMasked,
    inputMasked,
    note,
  });
  return resultPayload(
    'free_world_id',
    status,
    actorMasked,
    inputMasked,
    note,
  );
}

function runSimulation(
  scenario: SimulationResponse['scenario'],
): SimulationResponse {
  const results: EntryResponse[] = [];

  if (scenario === 'alice-five') {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      results.push(enterFreeWorldId('alice', 'mock-world-id', 'simulator'));
    }
  }

  if (scenario === 'bots-100') {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      results.push(enterFreeWorldId(`bot-${attempt + 1}`, '', 'simulator'));
    }
  }

  if (scenario === 'reuse-code') {
    results.push(enterProductCode('SNACK-123', 'simulator'));
    results.push(enterProductCode('SNACK-123', 'simulator'));
  }

  return {
    scenario,
    results,
    stats: currentSnapshot().stats,
  };
}

function resetDemoState(): CampaignSnapshot {
  const freshState = createInitialState();
  state.nextId = freshState.nextId;
  state.productCodeEntries = freshState.productCodeEntries;
  state.freeWorldIdEntries = freshState.freeWorldIdEntries;
  state.duplicateFreeAttempts = freshState.duplicateFreeAttempts;
  state.invalidOrReusedCodes = freshState.invalidOrReusedCodes;
  state.invalidProofAttempts = freshState.invalidProofAttempts;
  state.winners = freshState.winners;
  state.usedCodes = freshState.usedCodes;
  state.freeNullifiers = freshState.freeNullifiers;
  state.prizeInventory = freshState.prizeInventory;
  state.events = freshState.events;
  return currentSnapshot();
}

function getSnapshot(): CampaignSnapshot {
  return currentSnapshot();
}

export {
  campaignInfo,
  enterFreeWorldId,
  enterProductCode,
  getSnapshot,
  resetDemoState,
  runSimulation,
};
