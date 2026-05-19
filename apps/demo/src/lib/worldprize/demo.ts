import 'server-only';

import {
  createCampaignHash,
  createFreeEntryAction,
  createPromotionEngine,
  type CampaignConfig,
  type CampaignSnapshot,
  type EntryRequest,
  type EntryResponse,
  type SimulationResponse,
  type VerificationProof,
} from '@worldprize/core';
import { MemoryStorage } from '@worldprize/storage-memory';
import {
  MockWorldIdVerificationProvider,
  WorldIdVerificationProvider,
} from '@worldprize/world-id';

import {
  DEFAULT_WORLD_ACTION_FREE_ENTRY,
  DEFAULT_WORLD_APP_ID,
  DEFAULT_WORLD_RP_ID,
  normalizeWorldPrizeMode,
  type WorldPrizeMode,
} from './config';

export type { CampaignSnapshot, EntryResponse, SimulationResponse } from '@worldprize/core';

export type DemoEntryPayload =
  | {
      method: 'product_code';
      code: string;
      source?: string;
    }
  | {
      method: 'free_world_id';
      humanLabel: string;
      source?: string;
      dayKey?: string;
      idkitResult?: unknown;
      verificationResult?: { verified: true; nullifier: string } | null;
      proof?: VerificationProof | null;
    };

export const campaign: CampaignConfig = {
  id: 'snack-drop-2026',
  brand: 'SnackCo',
  campaignName: 'Snack Drop 2026',
  active: true,
  validProductCodes: ['SNACK-123', 'SNACK-456', 'SNACK-789'],
  freeEntryRule: 'One verified human per campaign day',
  instantWin: {
    numerator: 1,
    denominator: 3,
    maxWinners: 6,
  },
  prizeInventory: [
    { label: 'Limited-edition merch', quantity: 4 },
    { label: '25 USDC', quantity: 4 },
  ],
};

const storage = new MemoryStorage();
const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID ?? DEFAULT_WORLD_APP_ID;
const rpId = process.env.WORLD_RP_ID ?? DEFAULT_WORLD_RP_ID;
const actionFreeEntry =
  process.env.WORLD_ACTION_FREE_ENTRY ?? DEFAULT_WORLD_ACTION_FREE_ENTRY;
const worldPrizeMode = normalizeWorldPrizeMode(
  process.env.WORLDPRIZE_MODE ?? process.env.NEXT_PUBLIC_WORLDPRIZE_MODE,
);

const verificationProvider =
  worldPrizeMode === 'real'
    ? new WorldIdVerificationProvider({ rpId })
    : new MockWorldIdVerificationProvider({ appId, rpId });

const simulationVerificationProvider = new MockWorldIdVerificationProvider({
  appId,
  rpId,
});

const engine = createPromotionEngine({
  storage,
  verificationProvider,
});

const simulationEngine = createPromotionEngine({
  storage,
  verificationProvider: simulationVerificationProvider,
});

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function createMockFreeWorldProof(
  humanLabel: string,
  dayKey: string,
): VerificationProof {
  return {
    action: createFreeEntryAction(actionFreeEntry, dayKey),
    dayKey,
    humanLabel,
    mock: true,
  };
}

function createRealFreeWorldProof(
  humanLabel: string,
  dayKey: string,
  idkitResult: unknown,
): VerificationProof {
  return {
    action: actionFreeEntry,
    dayKey,
    humanLabel,
    payload: idkitResult,
  };
}

export const worldEnv = {
  mode: worldPrizeMode,
  appId,
  rpId,
  actionFreeEntry,
  signingKeyConfigured: Boolean(process.env.WORLD_SIGNING_KEY),
};

export const campaignHash = createCampaignHash(campaign);

export function getCampaign() {
  return {
    ...campaign,
    campaignSlug: campaign.id,
    campaignHash,
  };
}

export function getSnapshot(): CampaignSnapshot {
  return engine.snapshot(campaign.id);
}

export function resetDemoState(): CampaignSnapshot {
  return engine.reset(campaign.id);
}

export async function enterProductCode(
  code: string,
  source = 'web',
): Promise<EntryResponse> {
  return engine.enter({ campaign, method: 'product_code', code, source });
}

export async function enterFreeWorldId(input: {
  humanLabel: string;
  source?: string;
  dayKey?: string;
  idkitResult?: unknown;
  verificationResult?: { verified: true; nullifier: string } | null;
  proof?: VerificationProof | null;
}): Promise<EntryResponse> {
  const dayKey = input.dayKey ?? todayKey();
  const proof =
    input.proof ??
    (worldPrizeMode === 'real'
      ? createRealFreeWorldProof(
          input.humanLabel,
          dayKey,
          input.verificationResult ?? input.idkitResult,
        )
      : createMockFreeWorldProof(input.humanLabel, dayKey));

  return engine.enter({
    campaign,
    method: 'free_world_id',
    proof,
    dayKey,
    source: input.source ?? 'web',
  });
}

export async function enterBotAttempt(source = 'web'): Promise<EntryResponse> {
  return engine.enter({
    campaign,
    method: 'free_world_id',
    proof: null,
    source,
  });
}

export async function runSimulation(
  scenario: SimulationResponse['scenario'],
): Promise<SimulationResponse> {
  const results: EntryResponse[] = [];

  if (scenario === 'alice-five') {
    for (let index = 0; index < 5; index += 1) {
      results.push(await simulationEngine.enter({
        campaign,
        method: 'free_world_id',
        proof: createMockFreeWorldProof('Alice', todayKey()),
        dayKey: todayKey(),
        source: 'simulator',
      }));
    }
  }

  if (scenario === 'bots-100') {
    for (let index = 0; index < 100; index += 1) {
      results.push(await simulationEngine.enter({
        campaign,
        method: 'free_world_id',
        proof: null,
        source: 'simulator',
      }));
    }
  }

  if (scenario === 'reuse-code') {
    results.push(await simulationEngine.enter({
      campaign,
      method: 'product_code',
      code: 'SNACK-123',
      source: 'simulator',
    }));
    results.push(await simulationEngine.enter({
      campaign,
      method: 'product_code',
      code: 'SNACK-123',
      source: 'simulator',
    }));
  }

  return {
    scenario,
    results,
    stats: getSnapshot().stats,
  };
}

export async function enterEntry(
  request: EntryRequest & {
    humanLabel?: string;
    idkitResult?: unknown;
    verificationResult?: { verified: true; nullifier: string } | null;
  },
): Promise<EntryResponse> {
  if (request.method === 'product_code') {
    return enterProductCode(request.code, request.source);
  }

  return enterFreeWorldId({
    humanLabel: request.humanLabel ?? 'Guest',
    source: request.source,
    dayKey: request.dayKey,
    idkitResult: request.idkitResult,
    verificationResult: request.verificationResult,
    proof: request.proof,
  });
}

export async function enterDemoEntry(
  request: DemoEntryPayload,
): Promise<EntryResponse> {
  if (request.method === 'product_code') {
    return enterProductCode(request.code, request.source);
  }

  return enterFreeWorldId({
    humanLabel: request.humanLabel,
    source: request.source,
    dayKey: request.dayKey,
    idkitResult: request.idkitResult,
    verificationResult: request.verificationResult,
    proof: request.proof ?? undefined,
  });
}
