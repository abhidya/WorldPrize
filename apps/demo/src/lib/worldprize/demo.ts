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
      proof?: VerificationProof | null;
    };

const campaign: CampaignConfig = {
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
const appId =
  process.env.NEXT_PUBLIC_WORLD_APP_ID ??
  'app_25d16ee7904752aca5fef279f2fe11c7';
const rpId = process.env.WORLD_RP_ID ?? 'rp_3d1c7269a4c866a7';
const signingKey = process.env.WORLD_SIGNING_KEY;

const verificationProvider =
  signingKey && signingKey.length > 0
    ? new WorldIdVerificationProvider({ appId, rpId, signingKey })
    : new MockWorldIdVerificationProvider({ appId, rpId });

const engine = createPromotionEngine({
  storage,
  verificationProvider,
});

export const worldEnv = {
  appId,
  rpId,
  actionFreeEntry:
    process.env.WORLD_ACTION_FREE_ENTRY ?? 'worldprize-free-entry-demo',
  signingKeyConfigured: Boolean(signingKey),
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

export async function enterFreeWorldId(
  humanLabel: string,
  source = 'web',
  dayKey = new Date().toISOString().slice(0, 10),
  proof?: VerificationProof | null,
): Promise<EntryResponse> {
  const freeProof =
    proof ??
    ({
      action: createFreeEntryAction(worldEnv.actionFreeEntry, dayKey),
      dayKey,
      humanLabel,
      mock: true,
    } satisfies VerificationProof);

  return engine.enter({
    campaign,
    method: 'free_world_id',
    proof: freeProof,
    dayKey,
    source,
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
      results.push(await enterFreeWorldId('Alice', 'simulator'));
    }
  }

  if (scenario === 'bots-100') {
    for (let index = 0; index < 100; index += 1) {
      results.push(await enterBotAttempt('simulator'));
    }
  }

  if (scenario === 'reuse-code') {
    results.push(await enterProductCode('SNACK-123', 'simulator'));
    results.push(await enterProductCode('SNACK-123', 'simulator'));
  }

  return {
    scenario,
    results,
    stats: getSnapshot().stats,
  };
}

export async function enterEntry(request: EntryRequest): Promise<EntryResponse> {
  if (request.method === 'product_code') {
    return enterProductCode(request.code, request.source);
  }

  return enterFreeWorldId(
    request.proof?.humanLabel ?? 'Guest',
    request.source,
    request.dayKey,
    request.proof,
  );
}

export async function enterDemoEntry(
  request: DemoEntryPayload,
): Promise<EntryResponse> {
  if (request.method === 'product_code') {
    return enterProductCode(request.code, request.source);
  }

  return enterFreeWorldId(
    request.humanLabel,
    request.source,
    request.dayKey,
    request.proof ?? undefined,
  );
}
