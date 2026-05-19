import {
  createCampaignHash,
  headlineForEntry,
  hashNullifier,
  maskValue,
  type AuditEvent,
  type CampaignConfig,
  type CampaignSnapshot,
  type CommitEntryInput,
  type DemoStats,
  type EntryMethod,
  type EntryResponse,
  type EntryStatus,
  type PromotionStorage,
} from '@worldprize/core';

type CampaignState = {
  campaign: CampaignConfig;
  nextId: number;
  productCodeEntries: number;
  freeWorldIdEntries: number;
  duplicateFreeAttempts: number;
  invalidOrReusedCodes: number;
  invalidProofAttempts: number;
  winners: number;
  usedCodes: Set<string>;
  freeNullifiers: Set<string>;
  prizeInventory: CampaignConfig['prizeInventory'];
  events: AuditEvent[];
  configHash: string;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeHumanLabel(value: string): string {
  return value.trim().toLowerCase();
}

function maskCode(code: string): string {
  return maskValue(normalizeCode(code));
}

function maskHuman(value: string): string {
  return maskValue(normalizeHumanLabel(value));
}

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function initialState(campaign: CampaignConfig): CampaignState {
  return {
    campaign,
    nextId: 1,
    productCodeEntries: 0,
    freeWorldIdEntries: 0,
    duplicateFreeAttempts: 0,
    invalidOrReusedCodes: 0,
    invalidProofAttempts: 0,
    winners: 0,
    usedCodes: new Set(),
    freeNullifiers: new Set(),
    prizeInventory: campaign.prizeInventory.map((item) => ({ ...item })),
    events: [],
    configHash: createCampaignHash(campaign),
  };
}

export class MemoryStorage implements PromotionStorage {
  private readonly campaigns = new Map<string, CampaignState>();

  seedCampaign(campaign: CampaignConfig): void {
    this.campaigns.set(campaign.id, initialState(campaign));
  }

  ensureCampaign(campaign: CampaignConfig): void {
    if (!this.campaigns.has(campaign.id)) {
      this.seedCampaign(campaign);
    }
  }

  private stateFor(campaign: CampaignConfig): CampaignState {
    const existing = this.campaigns.get(campaign.id);
    if (existing) {
      return existing;
    }
    const fresh = initialState(campaign);
    this.campaigns.set(campaign.id, fresh);
    return fresh;
  }

  snapshot(campaignId: string): CampaignSnapshot {
    const state = this.campaigns.get(campaignId);
    if (!state) {
      throw new Error(`Unknown campaign: ${campaignId}`);
    }

    const stats = this.statsFromState(state, state.events.slice(0, 5));

    return {
      campaign: {
        ...state.campaign,
        campaignSlug: state.campaign.id,
        campaignHash: state.configHash,
      },
      stats,
      audit: [...state.events],
    };
  }

  reset(campaignId: string): CampaignSnapshot {
    const existing = this.campaigns.get(campaignId);
    if (!existing) {
      throw new Error(`Unknown campaign: ${campaignId}`);
    }

    const reset = initialState({
      ...existing.campaign,
      prizeInventory: existing.campaign.prizeInventory.map((item) => ({ ...item })),
    });
    this.campaigns.set(campaignId, reset);
    return this.snapshot(campaignId);
  }

  async commitEntry(input: CommitEntryInput): Promise<EntryResponse> {
    const state = this.stateFor(input.campaign);
    const { request } = input;
    const source = input.source;

    if (!input.campaign.active) {
      return this.reject(state, {
        method: request.method,
        status: 'CAMPAIGN_NOT_ACTIVE',
        actorMasked:
          request.method === 'product_code'
            ? 'guest'
            : maskHuman(request.proof?.humanLabel ?? 'guest'),
        inputMasked:
          request.method === 'product_code'
            ? maskCode(request.code)
            : maskHuman(request.proof?.humanLabel ?? 'guest'),
        note: `Campaign is paused for ${source} entries.`,
      });
    }

    if (request.method === 'product_code') {
      return this.handleProductCode(state, input, request.code);
    }

    return this.handleFreeEntry(state, input, request);
  }

  private handleProductCode(
    state: CampaignState,
    input: CommitEntryInput,
    code: string,
  ): EntryResponse {
    const normalizedCode = normalizeCode(code);
    const actorMasked = 'guest';
    const inputMasked = maskCode(normalizedCode);

    if (!input.campaign.validProductCodes.includes(normalizedCode)) {
      state.invalidOrReusedCodes += 1;
      this.record(state, {
        method: 'product_code',
        status: 'INVALID_CODE',
        actorMasked,
        inputMasked,
        note: `Rejected invalid code from ${input.source}.`,
      });
      return this.makeResponse(state, {
        method: 'product_code',
        status: 'INVALID_CODE',
        actorMasked,
        inputMasked,
        note: `Code ${inputMasked} is not in the campaign allow-list.`,
      });
    }

    if (state.usedCodes.has(normalizedCode)) {
      state.invalidOrReusedCodes += 1;
      this.record(state, {
        method: 'product_code',
        status: 'CODE_USED',
        actorMasked,
        inputMasked,
        note: `Attempted reuse from ${input.source}.`,
      });
      return this.makeResponse(state, {
        method: 'product_code',
        status: 'CODE_USED',
        actorMasked,
        inputMasked,
        note: `Code ${inputMasked} has already been redeemed.`,
      });
    }

    state.usedCodes.add(normalizedCode);
    state.productCodeEntries += 1;

    const prize = this.resolvePrize(state, input);
    if (prize) {
      state.winners += 1;
      const note = `Product-code entry won ${prize}.`;
      this.record(state, {
        method: 'product_code',
        status: 'WIN',
        actorMasked,
        inputMasked,
        prize,
        note,
      });
      return this.makeResponse(state, {
        method: 'product_code',
        status: 'WIN',
        actorMasked,
        inputMasked,
        note,
        prize,
      });
    }

    const wouldWin = input.shouldWin;
    const status: EntryStatus = wouldWin ? 'PRIZES_EXHAUSTED' : 'LOSE';
    const note =
      status === 'PRIZES_EXHAUSTED'
        ? 'The code qualified, but the prize pool is empty.'
        : 'Valid code, but the random odds missed.';

    this.record(state, {
      method: 'product_code',
      status,
      actorMasked,
      inputMasked,
      note,
    });
    return this.makeResponse(state, {
      method: 'product_code',
      status,
      actorMasked,
      inputMasked,
      note,
    });
  }

  private handleFreeEntry(
    state: CampaignState,
    input: CommitEntryInput,
    request: Extract<CommitEntryInput['request'], { method: 'free_world_id' }>,
  ): EntryResponse {
    const humanLabel = request.proof?.humanLabel ?? 'verified human';
    const dayKey = input.dayKey ?? todayKey();
    const nullifierHash = input.nullifierHash ?? null;
    const isMockProof = request.proof?.mock === true;
    const actorMasked = isMockProof
      ? maskHuman(humanLabel)
      : nullifierHash
        ? maskValue(nullifierHash, 2, 2)
        : 'verified human';
    const inputMasked = isMockProof ? maskHuman(humanLabel) : 'World ID proof';

    if (!nullifierHash) {
      state.invalidProofAttempts += 1;
      this.record(state, {
        method: 'free_world_id',
        status: 'INVALID_PROOF',
        actorMasked,
        inputMasked,
        note: `Rejected non-mock proof from ${input.source}.`,
      });
      return this.makeResponse(state, {
        method: 'free_world_id',
        status: 'INVALID_PROOF',
        actorMasked,
        inputMasked,
        note: 'World ID verification did not produce a nullifier hash.',
      });
    }

    const uniqueKey = hashNullifier(
      `${input.campaign.id}:${dayKey}:${nullifierHash}`,
    );
    if (state.freeNullifiers.has(uniqueKey)) {
      state.duplicateFreeAttempts += 1;
      this.record(state, {
        method: 'free_world_id',
        status: 'ALREADY_ENTERED',
        actorMasked,
        inputMasked,
        nullifierMasked: maskValue(nullifierHash, 2, 2),
        note: `Duplicate free-entry attempt blocked for ${dayKey}.`,
      });
      return this.makeResponse(state, {
        method: 'free_world_id',
        status: 'ALREADY_ENTERED',
        actorMasked,
        inputMasked,
        note: `One verified human per day: ${actorMasked} already entered on ${dayKey}.`,
      });
    }

    state.freeNullifiers.add(uniqueKey);
    state.freeWorldIdEntries += 1;

    const prize = this.resolvePrize(state, input);
    if (prize) {
      state.winners += 1;
      const note = `Free World ID entry won ${prize}.`;
      this.record(state, {
        method: 'free_world_id',
        status: 'WIN',
        actorMasked,
        inputMasked,
        prize,
        nullifierMasked: maskValue(nullifierHash, 2, 2),
        note,
      });
      return this.makeResponse(state, {
        method: 'free_world_id',
        status: 'WIN',
        actorMasked,
        inputMasked,
        note,
        prize,
      });
    }

    const wouldWin = input.shouldWin;
    const status: EntryStatus = wouldWin ? 'PRIZES_EXHAUSTED' : 'LOSE';
    const note =
      status === 'PRIZES_EXHAUSTED'
        ? 'The human check passed, but the prize pool is empty.'
        : 'Human check passed, but this entry missed the prize threshold.';

    this.record(state, {
      method: 'free_world_id',
      status,
      actorMasked,
      inputMasked,
      nullifierMasked: maskValue(nullifierHash, 2, 2),
      note,
    });
    return this.makeResponse(state, {
      method: 'free_world_id',
      status,
      actorMasked,
      inputMasked,
      note,
    });
  }

  private resolvePrize(state: CampaignState, input: CommitEntryInput): string | null {
    if (!input.shouldWin) {
      return null;
    }

    if (state.winners >= input.campaign.instantWin.maxWinners) {
      return null;
    }

    const nextPrize = state.prizeInventory.find((item) => item.quantity > 0);
    if (!nextPrize) {
      return null;
    }

    nextPrize.quantity -= 1;
    return nextPrize.label;
  }

  private record(state: CampaignState, event: Omit<AuditEvent, 'id' | 'timestamp'>) {
    state.events.unshift({
      id: state.nextId,
      timestamp: new Date().toISOString(),
      ...event,
    });
    state.nextId += 1;
  }

  private makeResponse(
    state: CampaignState,
    payload: {
      method: EntryMethod;
      status: EntryStatus;
      actorMasked: string;
      inputMasked: string;
      note: string;
      prize?: string;
    },
  ): EntryResponse {
    const stats = this.statsFromState(state, state.events.slice(0, 5));
    return {
      success:
        payload.status === 'WIN' ||
        payload.status === 'LOSE' ||
        payload.status === 'PRIZES_EXHAUSTED',
      result: {
        method: payload.method,
        status: payload.status,
        headline: headlineForEntry(payload.status),
        detail: payload.note,
        actorMasked: payload.actorMasked,
        inputMasked: payload.inputMasked,
        ...(payload.prize ? { prize: payload.prize } : {}),
      },
      stats,
    };
  }

  private reject(
    state: CampaignState,
    payload: {
      method: EntryMethod;
      status: EntryStatus;
      actorMasked: string;
      inputMasked: string;
      note: string;
    },
  ): EntryResponse {
    this.record(state, payload);
    return this.makeResponse(state, payload);
  }

  private statsFromState(
    state: CampaignState,
    recentEvents: AuditEvent[],
  ): DemoStats {
    return {
      campaignActive: state.campaign.active,
      productCodeEntries: state.productCodeEntries,
      freeWorldIdEntries: state.freeWorldIdEntries,
      duplicateFreeAttempts: state.duplicateFreeAttempts,
      invalidOrReusedCodes: state.invalidOrReusedCodes,
      invalidProofAttempts: state.invalidProofAttempts,
      winners: state.winners,
      prizesRemaining: state.prizeInventory.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      campaignConfigHash: state.configHash,
      inventory: state.prizeInventory.reduce<Record<string, number>>(
        (accumulator, item) => {
          if (item.quantity > 0) {
            accumulator[item.label] = item.quantity;
          }
          return accumulator;
        },
        {},
      ),
      recentEvents,
    };
  }
}
