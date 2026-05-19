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

export interface InstantWinRule {
  numerator: number;
  denominator: number;
  maxWinners: number;
}

export interface PrizeInventoryItem {
  label: string;
  quantity: number;
}

export interface CampaignConfig {
  id: string;
  brand: string;
  campaignName: string;
  active: boolean;
  validProductCodes: string[];
  freeEntryRule: string;
  instantWin: InstantWinRule;
  prizeInventory: PrizeInventoryItem[];
}

export interface EntryRequestBase {
  source?: string;
}

export interface ProductCodeEntryRequest extends EntryRequestBase {
  method: 'product_code';
  code: string;
}

export interface FreeWorldIdEntryRequest extends EntryRequestBase {
  method: 'free_world_id';
  proof?: VerificationProof | null;
  dayKey?: string;
}

export type EntryRequest =
  | ProductCodeEntryRequest
  | FreeWorldIdEntryRequest;

export interface VerificationProof {
  action: string;
  dayKey: string;
  humanLabel: string;
  signature?: string;
  mock?: boolean;
}

export interface VerificationResult {
  ok: boolean;
  nullifierHash?: string;
  reason?: 'INVALID_PROOF' | 'MISSING_PROOF' | 'SERVER_ERROR';
}

export interface VerificationProvider {
  verify(proof: VerificationProof): Promise<VerificationResult>;
}

export interface AuditEvent {
  id: number;
  timestamp: string;
  method: EntryMethod;
  status: EntryStatus;
  actorMasked: string;
  inputMasked: string;
  prize?: string;
  note: string;
  nullifierMasked?: string;
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
  recentEvents: AuditEvent[];
}

export interface CampaignSnapshot {
  campaign: CampaignConfig & {
    campaignSlug: string;
    campaignHash: string;
  };
  stats: DemoStats;
  audit: AuditEvent[];
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

export interface CommitEntryInput {
  campaign: CampaignConfig;
  request: EntryRequest;
  dayKey: string;
  nullifierHash?: string | null;
  shouldWin: boolean;
  source: string;
}

export interface PromotionStorage {
  commitEntry(input: CommitEntryInput): Promise<EntryResponse>;
  snapshot(campaignId: string): CampaignSnapshot;
  reset(campaignId: string): CampaignSnapshot;
}

export interface PromotionEngineOptions {
  storage: PromotionStorage;
  verificationProvider: VerificationProvider;
  rng?: () => number;
  clock?: () => Date;
}

export interface PromotionEngine {
  enter(request: EntryRequest & { campaign: CampaignConfig }): Promise<EntryResponse>;
  snapshot(campaignId: string): CampaignSnapshot;
  reset(campaignId: string): CampaignSnapshot;
}

function hashText(value: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  let hash = 2166136261;
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function hashToUnitInterval(value: string): number {
  const encoded = hashText(value);
  const numerator = Number.parseInt(encoded.slice(0, 8), 16);
  return numerator / 0xffffffff;
}

function currentDayKey(clock: () => Date): string {
  return clock().toISOString().slice(0, 10);
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
      return 'Inventory exhausted';
    case 'INVALID_PROOF':
      return 'Proof rejected';
  }
}

function shouldWin(rule: InstantWinRule, rng: () => number): boolean {
  if (rule.denominator <= 0 || rule.numerator <= 0) {
    return false;
  }
  const roll = Math.floor(rng() * rule.denominator);
  return roll < rule.numerator;
}

export function createPromotionEngine(
  options: PromotionEngineOptions,
): PromotionEngine {
  const rng = options.rng ?? Math.random;
  const clock = options.clock ?? (() => new Date());

  return {
    async enter(request) {
      if (request.method === 'free_world_id') {
        const dayKey = request.dayKey ?? currentDayKey(clock);
        const verification = request.proof
          ? await options.verificationProvider.verify(request.proof)
          : { ok: false, reason: 'MISSING_PROOF' as const };
        return options.storage.commitEntry({
          campaign: request.campaign,
          request: {
            ...request,
            dayKey,
          },
          dayKey,
          nullifierHash: verification.ok ? verification.nullifierHash : null,
          shouldWin: shouldWin(request.campaign.instantWin, rng),
          source: request.source ?? 'demo',
        });
      }

      return options.storage.commitEntry({
        campaign: request.campaign,
        request,
        dayKey: currentDayKey(clock),
        shouldWin: shouldWin(request.campaign.instantWin, rng),
        source: request.source ?? 'demo',
      });
    },
    snapshot(campaignId) {
      return options.storage.snapshot(campaignId);
    },
    reset(campaignId) {
      return options.storage.reset(campaignId);
    },
  };
}

export function createCampaignHash(campaign: CampaignConfig): string {
  return hashText(
    JSON.stringify({
      campaignId: campaign.id,
      brand: campaign.brand,
      campaignName: campaign.campaignName,
      validProductCodes: campaign.validProductCodes,
      freeEntryRule: campaign.freeEntryRule,
      instantWin: campaign.instantWin,
      prizeInventory: campaign.prizeInventory,
    }),
  ).slice(0, 12);
}

export function createFreeEntryAction(
  campaignId: string,
  dayKey: string,
): string {
  return `${campaignId}:free-entry:${dayKey}`;
}

export function maskValue(value: string, front = 3, back = 3): string {
  if (value.length <= front + back + 1) {
    return value;
  }
  return `${value.slice(0, front)}…${value.slice(-back)}`;
}

export function hashNullifier(input: string): string {
  return hashText(input);
}

export function headlineForEntry(status: EntryStatus): string {
  return headlineForStatus(status);
}

export function ratioFromRule(rule: InstantWinRule, rng: () => number): boolean {
  return shouldWin(rule, rng);
}
