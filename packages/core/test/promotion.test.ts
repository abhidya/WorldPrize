import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFreeEntryAction,
  createPromotionEngine,
  type CampaignConfig,
} from '../src/index';
import { MemoryStorage } from '../../storage-memory/src/index';
import {
  MockWorldIdVerificationProvider,
  WorldIdVerificationProvider,
  extractWorldNullifier,
} from '../../world-id/src/index';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

const dayKey = '2026-05-19';

function makeCampaign(overrides: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: 'snack-drop-2026',
    brand: 'SnackCo',
    campaignName: 'Snack Drop 2026',
    active: true,
    validProductCodes: ['SNACK-123', 'SNACK-456', 'SNACK-789'],
    freeEntryRule: 'One verified human per campaign day',
    instantWin: {
      numerator: 1,
      denominator: 2,
      maxWinners: 10,
    },
    prizeInventory: [
      { label: 'Limited-edition merch', quantity: 2 },
      { label: '25 USDC', quantity: 2 },
    ],
    ...overrides,
  };
}

function makeEngine(
  rng: () => number = () => 0.1,
  campaign: CampaignConfig = makeCampaign(),
) {
  const storage = new MemoryStorage();
  const verificationProvider = new MockWorldIdVerificationProvider({
    appId: 'app_test',
    rpId: 'rp_test',
  });

  const engine = createPromotionEngine({
    storage,
    verificationProvider,
    rng,
  });

  return { engine, storage, campaign };
}

function makeRealEngine(
  fetchImpl: typeof fetch,
  rng: () => number = () => 0.1,
  campaign: CampaignConfig = makeCampaign(),
) {
  const storage = new MemoryStorage();
  const verificationProvider = new WorldIdVerificationProvider({
    rpId: 'rp_test',
    fetchImpl,
  });

  const engine = createPromotionEngine({
    storage,
    verificationProvider,
    rng,
  });

  return { engine, storage, campaign };
}

async function enterProductCode(
  engine: ReturnType<typeof makeEngine>['engine'],
  campaign: CampaignConfig,
  code: string,
) {
  return engine.enter({
    campaign,
    method: 'product_code',
    code,
    source: 'test',
  });
}

async function enterFreeHuman(
  engine: ReturnType<typeof makeEngine>['engine'],
  campaign: CampaignConfig,
  humanLabel: string,
) {
  return engine.enter({
    campaign,
    method: 'free_world_id',
    proof: {
      action: createFreeEntryAction(campaign.id, dayKey),
      dayKey,
      humanLabel,
      mock: true,
    },
    dayKey,
    source: 'test',
  });
}

describe('WorldPrize promotion engine', () => {
  it('extractWorldNullifier reads common verifier shapes', () => {
    expect(extractWorldNullifier({ nullifier: 'n1' })).toBe('n1');
    expect(extractWorldNullifier({ nullifier_hash: 'n2' })).toBe('n2');
    expect(extractWorldNullifier({ responses: [{ nullifier: 'n3' }] })).toBe('n3');
    expect(extractWorldNullifier({ results: [{ success: true, nullifier: 'n4' }] })).toBe('n4');
    expect(
      extractWorldNullifier({ idkitResult: { responses: [{ nullifier: 'n5' }] } }),
    ).toBe('n5');
    expect(extractWorldNullifier({ missing: true })).toBeNull();
  });

  it('verifyWorldIdResult extracts nullifier from verifier responses and wrapped input', async () => {
    vi.stubEnv('WORLDPRIZE_MODE', 'real');
    vi.stubEnv('WORLD_RP_ID', 'rp_test');

    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          responses: [{ success: true, nullifier_hash: 'verify-nullifier-1' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    vi.stubGlobal('fetch', fetchImpl as typeof fetch);
    const { verifyWorldIdResult } = await import(
      '../../../apps/demo/src/lib/worldprize/world'
    );

    const result = await verifyWorldIdResult({
      idkitResult: { response: { ok: true } },
    });

    expect(result.ok).toBe(true);
    expect(result.nullifierHash).toBe('verify-nullifier-1');
    expect(result.debugShape?.verifierStatus).toBe(200);
    expect(result.debugShape?.hasResponsesArray).toBe(true);
  });

  it('verifyWorldIdResult reports missing nullifier with safe debug shape', async () => {
    vi.stubEnv('WORLDPRIZE_MODE', 'real');
    vi.stubEnv('WORLD_RP_ID', 'rp_test');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ success: true, responses: [{}] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as typeof fetch,
    );

    const { verifyWorldIdResult } = await import(
      '../../../apps/demo/src/lib/worldprize/world'
    );

    const result = await verifyWorldIdResult({ idkitResult: { proof: {} } });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MISSING_NULLIFIER');
    expect(result.debugShape?.inputTopLevelKeys).toContain('proof');
  });

  it('valid product code can enter once', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    const result = await enterProductCode(engine, campaign, 'SNACK-123');

    expect(result.success).toBe(true);
    expect(result.result.status).toBe('WIN');
  });

  it('product code cannot be reused', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    await enterProductCode(engine, campaign, 'SNACK-123');
    const reuse = await enterProductCode(engine, campaign, 'SNACK-123');

    expect(reuse.result.status).toBe('CODE_USED');
  });

  it('invalid product code rejected', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    const result = await enterProductCode(engine, campaign, 'NOPE-000');

    expect(result.result.status).toBe('INVALID_CODE');
  });

  it('Alice free entry accepted once', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    const result = await enterFreeHuman(engine, campaign, 'Alice');

    expect(result.result.status).toBe('WIN');
  });

  it('Alice duplicate blocked same day', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    await enterFreeHuman(engine, campaign, 'Alice');
    const duplicate = await enterFreeHuman(engine, campaign, 'Alice');

    expect(duplicate.result.status).toBe('ALREADY_ENTERED');
    expect(duplicate.stats.duplicateFreeAttempts).toBe(1);
  });

  it('Bob accepted same day', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    const result = await enterFreeHuman(engine, campaign, 'Bob');

    expect(result.result.status).toBe('WIN');
  });

  it('bot/no-proof rejected', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    const result = await engine.enter({
      campaign,
      method: 'free_world_id',
      proof: null,
      dayKey,
      source: 'test',
    });

    expect(result.result.status).toBe('INVALID_PROOF');
  });

  it('random odds win with injected RNG', async () => {
    const { engine, campaign } = makeEngine(() => 0.0);
    const result = await enterProductCode(engine, campaign, 'SNACK-123');

    expect(result.result.status).toBe('WIN');
  });

  it('random odds lose with injected RNG', async () => {
    const { engine, campaign } = makeEngine(() => 0.9);
    const result = await enterProductCode(engine, campaign, 'SNACK-123');

    expect(result.result.status).toBe('LOSE');
  });

  it('maxWinners enforced', async () => {
    const campaign = makeCampaign({
      instantWin: {
        numerator: 1,
        denominator: 1,
        maxWinners: 1,
      },
    });
    const { engine } = makeEngine(() => 0.0, campaign);

    const first = await enterProductCode(engine, campaign, 'SNACK-123');
    const second = await enterProductCode(engine, campaign, 'SNACK-456');

    expect(first.result.status).toBe('WIN');
    expect(second.result.status).toBe('PRIZES_EXHAUSTED');
  });

  it('prize inventory cannot go below zero', async () => {
    const campaign = makeCampaign({
      prizeInventory: [{ label: 'Limited-edition merch', quantity: 1 }],
      instantWin: {
        numerator: 1,
        denominator: 1,
        maxWinners: 10,
      },
    });
    const { engine } = makeEngine(() => 0.0, campaign);

    await enterProductCode(engine, campaign, 'SNACK-123');
    await enterProductCode(engine, campaign, 'SNACK-456');

    expect(engine.snapshot(campaign.id).stats.prizesRemaining).toBe(0);
  });

  it('public audit masks nullifier', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    await enterFreeHuman(engine, campaign, 'Alice');

    const event = engine.snapshot(campaign.id).audit[0];
    expect(event?.nullifierMasked).toContain('…');
    expect(event?.nullifierMasked).not.toContain('Alice');
  });

  it('real verified proof uses nullifier and masks World ID input', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          responses: [{ success: true, nullifier: 'real-nullifier-123' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const { engine, campaign } = makeRealEngine(fetchImpl, () => 0.1);

    const result = await engine.enter({
      campaign,
      method: 'free_world_id',
      proof: {
        action: createFreeEntryAction(campaign.id, dayKey),
        dayKey,
        humanLabel: 'verified human',
        payload: {
          verified: true,
          nullifier: 'real-nullifier-123',
        },
      },
      dayKey,
      source: 'world-id',
    });

    expect(result.success).toBe(true);
    expect(result.result.status).toBe('WIN');
    expect(result.result.actorMasked).not.toContain('Alice');
    expect(result.result.inputMasked).toBe('World ID proof');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('real verified proof blocks duplicate same day', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          responses: [{ success: true, nullifier: 'dup-nullifier-123' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const { engine, campaign } = makeRealEngine(fetchImpl, () => 0.1);

    const proof = {
      action: createFreeEntryAction(campaign.id, dayKey),
      dayKey,
      humanLabel: 'verified human',
      payload: {
        verified: true,
        nullifier: 'dup-nullifier-123',
      },
    };

    await engine.enter({
      campaign,
      method: 'free_world_id',
      proof,
      dayKey,
      source: 'world-id',
    });

    const duplicate = await engine.enter({
      campaign,
      method: 'free_world_id',
      proof,
      dayKey,
      source: 'world-id',
    });

    expect(duplicate.result.status).toBe('ALREADY_ENTERED');
    expect(duplicate.stats.duplicateFreeAttempts).toBe(1);
  });

  it('admin stats count duplicate attempts', async () => {
    const { engine, campaign } = makeEngine(() => 0.1);
    await enterFreeHuman(engine, campaign, 'Alice');
    await enterFreeHuman(engine, campaign, 'Alice');

    expect(engine.snapshot(campaign.id).stats.duplicateFreeAttempts).toBe(1);
  });
});
