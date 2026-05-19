'use client';

import type {
  CampaignSnapshot,
  EntryResponse,
  SimulationResponse,
} from '@/lib/worldprize/demo';
import Link from 'next/link';
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

type WorldConfig = {
  mode: 'mock' | 'real';
  appId: string;
  rpId: string;
  actionFreeEntry: string;
  signingKeyConfigured: boolean;
};

type WorldPrizeDemoProps = {
  worldConfig?: WorldConfig;
};

type EntryFormState = {
  productCode: string;
  humanId: string;
};

type EntryPayload =
  | {
      method: 'product_code';
      code: string;
    }
  | {
      method: 'free_world_id';
      humanLabel: string;
    };

const defaultWorldConfig: WorldConfig = {
  mode: 'mock',
  appId: 'app_25d16ee7904752aca5fef279f2fe11c7',
  rpId: 'rp_3d1c7269a4c866a7',
  actionFreeEntry: 'worldprize-free-entry-demo',
  signingKeyConfigured: false,
};

const initialFormState: EntryFormState = {
  productCode: 'SNACK-123',
  humanId: 'Alice',
};

function statusLabel(status: EntryResponse['result']['status']) {
  switch (status) {
    case 'WIN':
      return 'Winner';
    case 'LOSE':
      return 'Entry accepted';
    case 'ALREADY_ENTERED':
      return 'Duplicate blocked';
    case 'INVALID_CODE':
      return 'Invalid code';
    case 'CODE_USED':
      return 'Code reused';
    case 'CAMPAIGN_NOT_ACTIVE':
      return 'Campaign paused';
    case 'PRIZES_EXHAUSTED':
      return 'Inventory empty';
    case 'INVALID_PROOF':
      return 'Proof rejected';
  }
}

function resultToneClass(status: EntryResponse['result']['status']) {
  switch (status) {
    case 'WIN':
      return 'wp-result-win';
    case 'INVALID_CODE':
    case 'CODE_USED':
    case 'CAMPAIGN_NOT_ACTIVE':
    case 'PRIZES_EXHAUSTED':
    case 'INVALID_PROOF':
      return 'wp-result-warn';
    default:
      return 'wp-result-lose';
  }
}

function ResultKeyValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="wp-stat">
      <p className="wp-stat-label">{label}</p>
      <p className="wp-stat-value">{value}</p>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="wp-card">
      <div className="wp-card-header">
        <div>
          <p className="wp-card-eyebrow">{eyebrow}</p>
          <h2 className="wp-card-title">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function WorldPrizeDemo({
  worldConfig = defaultWorldConfig,
}: WorldPrizeDemoProps = {}) {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [result, setResult] = useState<EntryResponse['result'] | null>(null);
  const [formState, setFormState] = useState<EntryFormState>(initialFormState);
  const [isInstalled, setIsInstalled] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);
  const [worldRpContext, setWorldRpContext] = useState<RpContext | null>(null);
  const [worldIdkitResult, setWorldIdkitResult] =
    useState<IDKitResult | null>(null);
  const [worldVerificationResult, setWorldVerificationResult] = useState<{
    verified: true;
    nullifier: string;
  } | null>(null);

  const isRealMode = worldConfig.mode === 'real';
  const recentEvents = snapshot?.stats.recentEvents ?? [];
  const campaignHash =
    snapshot?.stats.campaignConfigHash ?? snapshot?.campaign.campaignHash ?? '—';

  const refreshStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load campaign snapshot');
      }

      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load campaign snapshot.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    try {
      setIsInstalled(Boolean(MiniKit.isInstalled()));
    } catch {
      setIsInstalled(false);
    }
  }, []);

  const updateResultFromResponse = useCallback(
    async (response: Response) => {
      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = (await response.json()) as EntryResponse;
      setResult(data.result);
      await refreshStats();
      return data;
    },
    [refreshStats],
  );

  const submitProductCode = useCallback(
    async (code: string) => {
      setBusyAction('product_code');
      setResult(null);
      try {
        const response = await fetch('/api/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'product_code', code }),
        });

        await updateResultFromResponse(response);
      } catch {
        setResult({
          method: 'product_code',
          status: 'INVALID_CODE',
          headline: 'Request failed',
          detail: 'The demo server could not process the product code.',
          actorMasked: 'guest',
          inputMasked: 'n/a',
        });
      } finally {
        setBusyAction(null);
      }
    },
    [updateResultFromResponse],
  );

  const submitMockFreeEntry = useCallback(
    async (humanLabel: string) => {
      setBusyAction('free_world_id');
      setResult(null);
      try {
        const response = await fetch('/api/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'free_world_id',
            humanLabel,
            dayKey: new Date().toISOString().slice(0, 10),
            source: 'mock',
          }),
        });

        await updateResultFromResponse(response);
      } catch {
        setResult({
          method: 'free_world_id',
          status: 'INVALID_PROOF',
          headline: 'Request failed',
          detail: 'The demo server could not process the free entry.',
          actorMasked: 'guest',
          inputMasked: 'n/a',
        });
      } finally {
        setBusyAction(null);
      }
    },
    [updateResultFromResponse],
  );

  const openWorldFlow = useCallback(async () => {
    setBusyAction('free_world_id');
    setResult(null);
    try {
      if (!worldRpContext) {
        const response = await fetch('/api/world/sign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: worldConfig.actionFreeEntry }),
        });

        if (!response.ok) {
          throw new Error('World sign request failed');
        }

        setWorldRpContext((await response.json()) as RpContext);
      }

      setWorldIdkitResult(null);
      setWorldVerificationResult(null);
      setWorldOpen(true);
    } catch {
      setResult({
        method: 'free_world_id',
        status: 'INVALID_PROOF',
        headline: 'World ID request failed',
        detail: 'The demo could not prepare the World ID flow.',
        actorMasked: 'guest',
        inputMasked: 'n/a',
      });
    } finally {
      setBusyAction(null);
    }
  }, [worldConfig.actionFreeEntry, worldRpContext]);

  const handleWorldVerify = useCallback(async (idkitResult: IDKitResult) => {
    setWorldIdkitResult(idkitResult);
    const response = await fetch('/api/world/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idkitResult }),
    });

    if (!response.ok) {
      throw new Error('Backend verification failed');
    }

    setWorldVerificationResult(
      (await response.json()) as { verified: true; nullifier: string },
    );
  }, []);

  const submitRealWorldEntry = useCallback(async () => {
    if (!worldIdkitResult) {
      throw new Error('Missing IDKit result');
    }

    setBusyAction('free_world_id');
    setResult(null);
    try {
      const response = await fetch('/api/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'free_world_id',
          humanLabel: formState.humanId,
          dayKey: new Date().toISOString().slice(0, 10),
          source: isInstalled ? 'world-app' : 'browser',
          idkitResult: worldIdkitResult,
          verificationResult: worldVerificationResult,
        }),
      });

      await updateResultFromResponse(response);
      setWorldOpen(false);
    } catch {
      setResult({
        method: 'free_world_id',
        status: 'INVALID_PROOF',
        headline: 'Request failed',
        detail: 'The real World ID flow could not be completed.',
        actorMasked: 'guest',
        inputMasked: 'n/a',
      });
    } finally {
      setBusyAction(null);
    }
  }, [
    formState.humanId,
    isInstalled,
    updateResultFromResponse,
    worldIdkitResult,
    worldVerificationResult,
  ]);

  const submitEntry = useCallback(
    async (payload: EntryPayload) => {
      if (payload.method === 'free_world_id' && isRealMode) {
        await openWorldFlow();
        return;
      }

      if (payload.method === 'product_code') {
        await submitProductCode(payload.code);
        return;
      }

      await submitMockFreeEntry(payload.humanLabel);
    },
    [isRealMode, openWorldFlow, submitMockFreeEntry, submitProductCode],
  );

  const runSimulation = useCallback(
    async (scenario: SimulationResponse['scenario']) => {
      setBusyAction(scenario);
      setResult(null);
      try {
        const response = await fetch('/api/admin/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario }),
        });

        if (!response.ok) {
          throw new Error('Simulation failed');
        }

        const data = (await response.json()) as SimulationResponse;
        await refreshStats();
        if (data.results.length > 0) {
          setResult(data.results[data.results.length - 1]!.result);
        }
      } catch {
        setResult({
          method: 'product_code',
          status: 'INVALID_CODE',
          headline: 'Simulation failed',
          detail: 'The abuse simulator could not run.',
          actorMasked: 'admin',
          inputMasked: scenario,
        });
      } finally {
        setBusyAction(null);
      }
    },
    [refreshStats],
  );

  const resetDemo = useCallback(async () => {
    setBusyAction('reset');
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Reset failed');
      }

      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
      setResult(null);
      setFormState(initialFormState);
      setWorldRpContext(null);
      setWorldIdkitResult(null);
      setWorldVerificationResult(null);
      setWorldOpen(false);
    } catch {
      setLoadError('Reset failed.');
    } finally {
      setBusyAction(null);
    }
  }, []);

  const resultTone = result ? resultToneClass(result.status) : 'wp-result-lose';
  const modeBadgeTone = isRealMode ? 'amber' : 'green';
  const modeBadgeText = isRealMode ? 'real mode' : 'mock mode';

  return (
    <main className="wp-page">
      <section className="wp-hero">
        <div className="wp-badge-row">
          <span className="wp-badge" data-tone="cyan">
            WorldPrize
          </span>
          <span className="wp-badge" data-tone={modeBadgeTone}>
            {modeBadgeText}
          </span>
          <span className="wp-badge" data-tone="cyan">
            AMOE / free-entry
          </span>
        </div>

        <p className="wp-eyebrow">WorldPrize</p>
        <h1 className="wp-title">
          World ID-protected AMOE/free-entry demo for instant-win promos.
        </h1>
        <p className="wp-subtitle">
          Many purchase-based instant-win promotions need a no-purchase/free
          entry route. WorldPrize shows how that free route can stay accessible
          without becoming an unlimited bot target.
        </p>
        <p className="wp-description">
          Product codes still drive purchase engagement, while the free-entry
          route is protected by one-human-per-day proof. Duplicate attempts are
          blocked, and the public audit trail masks sensitive identifiers.
        </p>

        <div className="wp-actions">
          <Link href="/audit" className="wp-button wp-button-secondary">
            Public audit log
          </Link>
          <button
            type="button"
            onClick={() => void refreshStats()}
            className="wp-button wp-button-primary"
          >
            {loading ? 'Refreshing stats…' : 'Refresh stats'}
          </button>
        </div>
      </section>

      {loadError ? (
        <section className="wp-section wp-result wp-result-warn">
          <p className="wp-card-eyebrow">Stats load failed</p>
          <h2 className="wp-card-title">Unable to load campaign snapshot</h2>
          <p className="wp-muted" style={{ marginTop: '0.75rem' }}>
            {loadError}
          </p>
        </section>
      ) : null}

      <section className="wp-section wp-grid wp-grid-3">
        <ResultKeyValue
          label="Campaign"
          value={snapshot?.campaign.campaignName ?? 'Snack Drop 2026'}
        />
        <ResultKeyValue
          label="Product-code entries"
          value={snapshot?.stats.productCodeEntries ?? 0}
        />
        <ResultKeyValue
          label="Verified free entries"
          value={snapshot?.stats.freeWorldIdEntries ?? 0}
        />
        <ResultKeyValue label="Winners" value={snapshot?.stats.winners ?? 0} />
      </section>

      <section className="wp-section wp-grid wp-grid-2">
        <SectionCard eyebrow="Entry methods" title="Choose a promo path">
          <div className="wp-grid wp-grid-2">
            <form
              className="wp-card"
              onSubmit={(event) => {
                event.preventDefault();
                void submitEntry({
                  method: 'product_code',
                  code: formState.productCode,
                });
              }}
            >
              <p className="wp-card-title">I have a product code</p>
              <p className="wp-muted" style={{ margin: '0.6rem 0 0' }}>
                Simulates the purchase-driven path. Valid package codes are
                accepted once, then locked.
              </p>
              <label style={{ display: 'block', marginTop: '1rem' }}>
                <span className="wp-card-eyebrow">Code</span>
                <input
                  value={formState.productCode}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      productCode: event.target.value,
                    }))
                  }
                  className="wp-input"
                  placeholder="SNACK-123"
                />
              </label>
              <button
                type="submit"
                disabled={busyAction === 'product_code'}
                className="wp-button wp-button-primary"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                {busyAction === 'product_code'
                  ? 'Checking code…'
                  : 'Enter with code'}
              </button>
            </form>

            <div className="wp-card">
              <p className="wp-card-title">No purchase? Free daily entry with World ID</p>
              <p className="wp-muted" style={{ margin: '0.6rem 0 0' }}>
                In production, World App returns a proof that the backend
                verifies before storing a campaign-day nullifier. In this demo,
                Alice/Bob/Charlie simulate verified humans.
              </p>

              {!isRealMode ? (
                <>
                  <label style={{ display: 'block', marginTop: '1rem' }}>
                    <span className="wp-card-eyebrow">Demo human</span>
                    <input
                      value={formState.humanId}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          humanId: event.target.value,
                        }))
                      }
                      className="wp-input"
                      placeholder="Alice"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      void submitEntry({
                        method: 'free_world_id',
                        humanLabel: formState.humanId,
                      })
                    }
                    disabled={busyAction === 'free_world_id'}
                    className="wp-button wp-button-secondary"
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    {busyAction === 'free_world_id'
                      ? 'Verifying human…'
                      : 'Verify & enter'}
                  </button>
                </>
              ) : (
                <>
                  {!isInstalled ? (
                    <p
                      className="wp-result wp-result-warn"
                      style={{ marginTop: '1rem' }}
                    >
                      Open in World App to verify with World ID. The free-entry
                      path requires a World ID proof that can only be generated
                      inside World App.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void openWorldFlow()}
                    disabled={busyAction === 'free_world_id' || !isInstalled}
                    className="wp-button wp-button-secondary"
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    {busyAction === 'free_world_id'
                      ? 'Opening IDKit…'
                      : isInstalled
                        ? 'Verify with World ID'
                        : 'Open in World App to verify with World ID'}
                  </button>

                  {worldRpContext ? (
                    <IDKitRequestWidget
                      open={worldOpen}
                      onOpenChange={setWorldOpen}
                      app_id={worldConfig.appId as `app_${string}`}
                      action={worldConfig.actionFreeEntry}
                      rp_context={worldRpContext}
                      allow_legacy_proofs={true}
                      environment={
                        process.env.NODE_ENV === 'production'
                          ? 'production'
                          : 'staging'
                      }
                      preset={orbLegacy({
                        signal: worldConfig.actionFreeEntry,
                      })}
                      handleVerify={handleWorldVerify}
                      onSuccess={() => {
                        void submitRealWorldEntry();
                      }}
                      onError={(errorCode) => {
                        setWorldOpen(false);
                        setBusyAction(null);
                        setResult({
                          method: 'free_world_id',
                          status: 'INVALID_PROOF',
                          headline: 'World ID request failed',
                          detail: `IDKit returned ${errorCode}.`,
                          actorMasked: 'guest',
                          inputMasked: 'n/a',
                        });
                      }}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Last result" title="Response preview">
          <div className={`wp-result ${resultTone}`}>
            {result ? (
              <>
                <div className="wp-card-header" style={{ marginBottom: '0.5rem' }}>
                  <div>
                    <p className="wp-card-eyebrow">{statusLabel(result.status)}</p>
                    <h3 className="wp-card-title" style={{ marginTop: 0 }}>
                      {result.headline}
                    </h3>
                  </div>
                  {result.prize ? (
                    <span className="wp-badge" data-tone="green">
                      {result.prize}
                    </span>
                  ) : null}
                </div>
                <p className="wp-muted" style={{ lineHeight: 1.7 }}>
                  {result.detail}
                </p>
                <div className="wp-grid wp-grid-2" style={{ marginTop: '1rem' }}>
                  <div className="wp-audit-event">
                    <p className="wp-card-eyebrow">Actor</p>
                    <p className="wp-stat-value">{result.actorMasked}</p>
                  </div>
                  <div className="wp-audit-event">
                    <p className="wp-card-eyebrow">Input</p>
                    <p className="wp-stat-value">{result.inputMasked}</p>
                  </div>
                  <div className="wp-audit-event">
                    <p className="wp-card-eyebrow">Method</p>
                    <p className="wp-stat-value">{result.method}</p>
                  </div>
                  <div className="wp-audit-event">
                    <p className="wp-card-eyebrow">Outcome</p>
                    <p className="wp-stat-value">{result.status}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="wp-muted" style={{ lineHeight: 1.7 }}>
                Use a product code or a mock World ID proof to see the
                instant-win response. The demo uses deterministic mock
                identities and code inventory so the interview flow is
                repeatable.
              </p>
            )}
          </div>

          <div className="wp-grid wp-grid-2" style={{ marginTop: '1rem' }}>
            <div className="wp-card">
              <p className="wp-card-eyebrow">Public rules</p>
              <p style={{ margin: '0.5rem 0 0', lineHeight: 1.7 }}>
                One verified human per campaign day, or one-time code use.
                Production campaigns may need a fallback AMOE for users who
                cannot access World ID.
              </p>
            </div>
            <div className="wp-card">
              <p className="wp-card-eyebrow">Config hash</p>
              <p className="wp-stat-value" style={{ marginTop: '0.5rem', fontSize: '0.95rem' }}>
                {campaignHash}
              </p>
              <p className="wp-muted" style={{ marginTop: '0.5rem' }}>
                {isRealMode && worldConfig.signingKeyConfigured
                  ? 'Real mode signer configured.'
                  : 'Mock demo config.'}
              </p>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="wp-section wp-grid wp-grid-2">
        <SectionCard eyebrow="Abuse simulator" title="Demo-only attack scenarios">
          <p style={{ lineHeight: 1.7 }}>
            These buttons are intentionally visible so the interview narrative
            can show the defensive story: duplicate humans are blocked,
            repeated codes are rejected, and bot-style requests fail without a
            proof.
          </p>
          <div className="wp-grid" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              onClick={() => void runSimulation('alice-five')}
              disabled={busyAction === 'alice-five'}
              className="wp-button wp-button-secondary"
            >
              Simulate Alice trying 5 times
            </button>
            <button
              type="button"
              onClick={() => void runSimulation('bots-100')}
              disabled={busyAction === 'bots-100'}
              className="wp-button wp-button-secondary"
            >
              Simulate 100 fake bot attempts
            </button>
            <button
              type="button"
              onClick={() => void runSimulation('reuse-code')}
              disabled={busyAction === 'reuse-code'}
              className="wp-button wp-button-secondary"
            >
              Simulate code reuse
            </button>
            <button
              type="button"
              onClick={() => void resetDemo()}
              disabled={busyAction === 'reset'}
              className="wp-button wp-button-danger"
            >
              Reset demo state
            </button>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Admin dashboard" title="Promo health at a glance">
          <div className="wp-grid wp-grid-2">
            <ResultKeyValue
              label="Duplicate free attempts"
              value={snapshot?.stats.duplicateFreeAttempts ?? 0}
            />
            <ResultKeyValue
              label="Invalid / reused codes"
              value={snapshot?.stats.invalidOrReusedCodes ?? 0}
            />
            <ResultKeyValue
              label="Invalid proofs"
              value={snapshot?.stats.invalidProofAttempts ?? 0}
            />
            <ResultKeyValue
              label="Prizes remaining"
              value={snapshot?.stats.prizesRemaining ?? 0}
            />
          </div>

          <div className="wp-card" style={{ marginTop: '1rem' }}>
            <div className="wp-card-header">
              <div>
                <p className="wp-card-eyebrow">Inventory</p>
                <h3 className="wp-card-title">Prize pool status</h3>
              </div>
              <span className="wp-muted">{snapshot?.campaign.freeEntryRule ?? '—'}</span>
            </div>
            <div className="wp-badge-row" style={{ marginBottom: 0 }}>
              {snapshot ? (
                Object.keys(snapshot.stats.inventory).length > 0 ? (
                  Object.entries(snapshot.stats.inventory).map(
                    ([prize, count]) => (
                      <span key={prize} className="wp-badge">
                        {prize} × {count}
                      </span>
                    ),
                  )
                ) : (
                  <span className="wp-muted">All prizes have been claimed.</span>
                )
              ) : (
                <span className="wp-muted">Loading inventory…</span>
              )}
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="wp-section wp-grid wp-grid-2">
        <SectionCard eyebrow="Public audit preview" title="Masked event trail">
          <p className="wp-muted" style={{ lineHeight: 1.7 }}>
            The audit trail keeps the story visible without exposing full
            nullifiers or raw identifiers.
          </p>
          <ul className="wp-list" style={{ marginTop: '1rem' }}>
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <li key={event.id} className="wp-audit-event">
                  <div className="wp-card-header" style={{ marginBottom: '0.5rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, color: 'var(--white)' }}>
                      {event.method}
                    </p>
                    <span className="wp-card-eyebrow" style={{ margin: 0 }}>
                      {event.status}
                    </span>
                  </div>
                  <p className="wp-muted" style={{ margin: 0, lineHeight: 1.6 }}>
                    {event.actorMasked} • {event.inputMasked}
                  </p>
                  <p className="wp-muted" style={{ margin: '0.45rem 0 0', lineHeight: 1.6 }}>
                    {event.note}
                  </p>
                </li>
              ))
            ) : (
              <li className="wp-muted">
                No events yet. Enter a code or verify a human to populate the
                audit log.
              </li>
            )}
          </ul>
        </SectionCard>

        <SectionCard eyebrow="Interview talking points" title="How to frame WorldPrize">
          <ul className="wp-list" style={{ lineHeight: 1.7 }}>
            <li>
              <span style={{ color: 'var(--white)', fontWeight: 700 }}>What it is:</span>{' '}
              a small World ID reference integration for AMOE/free-entry
              protection.
            </li>
            <li>
              <span style={{ color: 'var(--white)', fontWeight: 700 }}>What it is not:</span>{' '}
              a full raffle SaaS or legal compliance engine.
            </li>
            <li>
              <span style={{ color: 'var(--white)', fontWeight: 700 }}>Why it matters:</span>{' '}
              it demonstrates a practical, privacy-preserving way to make the
              no-purchase path harder to farm.
            </li>
            <li>
              <span style={{ color: 'var(--white)', fontWeight: 700 }}>
                How to present it:
              </span>{' '}
              “Product codes still drive purchase engagement, while the free
              route becomes one verified human per day.”
            </li>
          </ul>
        </SectionCard>
      </section>

      <footer className="wp-footer">
        WorldPrize demo • mock mode • in-memory demo state
      </footer>
    </main>
  );
}
