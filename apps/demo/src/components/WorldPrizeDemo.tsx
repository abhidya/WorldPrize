'use client';

import {
  DEFAULT_WORLD_ACTION_FREE_ENTRY,
  DEFAULT_WORLD_APP_ID,
  DEFAULT_WORLD_RP_ID,
  normalizeWorldPrizeMode,
  type WorldPrizeMode,
  type WorldRpContext,
  type WorldRpSignature,
} from '@/lib/worldprize/config';
import type { CampaignSnapshot, EntryResponse, SimulationResponse } from '@worldprize/core';
import { IDKitRequestWidget, orbLegacy } from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import { useCallback, useEffect, useMemo, useState } from 'react';

type EntryFormState = {
  productCode: string;
  humanLabel: string;
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

type WorldSession = {
  humanLabel: string;
  dayKey: string;
  rpContext: WorldRpContext;
};

const initialFormState: EntryFormState = {
  productCode: 'SNACK-123',
  humanLabel: 'Alice',
};

function statusTone(status: EntryResponse['result']['status']) {
  switch (status) {
    case 'WIN':
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
    case 'LOSE':
      return 'border-slate-500/30 bg-slate-500/10 text-slate-100';
    case 'ALREADY_ENTERED':
    case 'CODE_USED':
    case 'INVALID_CODE':
    case 'INVALID_PROOF':
    case 'CAMPAIGN_NOT_ACTIVE':
    case 'PRIZES_EXHAUSTED':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-50';
  }
}

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

function Card({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function WorldPrizeDemo() {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [result, setResult] = useState<EntryResponse['result'] | null>(null);
  const [formState, setFormState] = useState<EntryFormState>(initialFormState);
  const [worldPrizeMode, setWorldPrizeMode] = useState<WorldPrizeMode>(
    normalizeWorldPrizeMode(process.env.NEXT_PUBLIC_WORLDPRIZE_MODE),
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [worldSession, setWorldSession] = useState<WorldSession | null>(null);
  const [worldWidgetOpen, setWorldWidgetOpen] = useState(false);

  useEffect(() => {
    const installed = MiniKit.isInstalled();
    setIsInstalled(installed);
    if (process.env.NEXT_PUBLIC_WORLDPRIZE_MODE == null && installed) {
      setWorldPrizeMode('real');
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stats', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load campaign snapshot');
      }
      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  const entryTitle = useMemo(
    () =>
      result?.headline ??
      'Enter the campaign with a product code or a World ID proof',
    [result?.headline],
  );

  const openWorldFlow = useCallback(async () => {
    setBusyAction('free_world_id');
    setResult(null);
    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      const response = await fetch('/api/world/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: DEFAULT_WORLD_ACTION_FREE_ENTRY }),
      });
      if (!response.ok) {
        throw new Error('World sign request failed');
      }

      const signature = (await response.json()) as WorldRpSignature;
      setWorldSession({
        humanLabel: formState.humanLabel,
        dayKey,
        rpContext: {
          rp_id: process.env.NEXT_PUBLIC_WORLD_RP_ID ?? DEFAULT_WORLD_RP_ID,
          ...signature,
        },
      });
      setWorldWidgetOpen(true);
    } catch {
      setResult({
        method: 'free_world_id',
        status: 'INVALID_PROOF',
        headline: 'World ID request failed',
        detail: 'The demo could not open the World ID request.',
        actorMasked: 'guest',
        inputMasked: 'n/a',
      });
    } finally {
      setBusyAction(null);
    }
  }, [formState.humanLabel]);

  const handleWorldVerify = useCallback(
    async (idkitResult: unknown) => {
      if (!worldSession) {
        throw new Error('World session missing');
      }

      const response = await fetch('/api/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: 'free_world_id',
          humanLabel: worldSession.humanLabel,
          dayKey: worldSession.dayKey,
          idkitResult,
          source: isInstalled ? 'world-app' : 'browser',
        }),
      });

      const data = (await response.json()) as EntryResponse;
      setResult(data.result);
      await refreshSnapshot();

      if (!response.ok || data.result.status === 'INVALID_PROOF') {
        throw new Error('World ID verification failed');
      }
    },
    [isInstalled, refreshSnapshot, worldSession],
  );

  const submitEntry = useCallback(
    async (payload: EntryPayload) => {
      if (payload.method === 'free_world_id' && worldPrizeMode === 'real') {
        await openWorldFlow();
        return;
      }

      setBusyAction(payload.method);
      setResult(null);
      try {
        const body =
          payload.method === 'product_code'
            ? payload
            : {
                method: 'free_world_id' as const,
                humanLabel: payload.humanLabel,
                dayKey: new Date().toISOString().slice(0, 10),
                source: 'mock',
              };

        const response = await fetch('/api/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error('Entry failed');
        }

        const data = (await response.json()) as EntryResponse;
        setResult(data.result);
        await refreshSnapshot();
      } catch {
        setResult({
          method: payload.method,
          status:
            payload.method === 'product_code'
              ? 'INVALID_CODE'
              : 'INVALID_PROOF',
          headline: 'Request failed',
          detail: 'The demo server could not process the entry.',
          actorMasked: 'guest',
          inputMasked: 'n/a',
        });
      } finally {
        setBusyAction(null);
      }
    },
    [openWorldFlow, refreshSnapshot, worldPrizeMode],
  );

  const runSimulation = useCallback(
    async (scenario: SimulationResponse['scenario']) => {
      setBusyAction(scenario);
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
        await refreshSnapshot();
        if (data.results.length > 0) {
          setResult(data.results[data.results.length - 1]!.result);
        }
      } finally {
        setBusyAction(null);
      }
    },
    [refreshSnapshot],
  );

  const resetDemo = useCallback(async () => {
    setBusyAction('reset');
    try {
      const response = await fetch('/api/admin/reset', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Reset failed');
      }
      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
      setResult(null);
      setFormState(initialFormState);
      setWorldSession(null);
      setWorldWidgetOpen(false);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const recentEvents = snapshot?.stats.recentEvents ?? [];
  const worldAppLabel = isInstalled ? 'World App detected' : 'Browser flow';
  const modeLabel =
    worldPrizeMode === 'real' ? 'Real World ID mode' : 'Mock mode active';

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_32%),linear-gradient(180deg,#07111f_0%,#04070c_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {worldPrizeMode === 'real' && worldSession ? (
          <IDKitRequestWidget
            open={worldWidgetOpen}
            onOpenChange={setWorldWidgetOpen}
            app_id={process.env.NEXT_PUBLIC_WORLD_APP_ID ?? DEFAULT_WORLD_APP_ID}
            action={DEFAULT_WORLD_ACTION_FREE_ENTRY}
            rp_context={worldSession.rpContext}
            allow_legacy_proofs={true}
            environment="production"
            preset={orbLegacy({
              signal: worldSession.humanLabel,
            })}
            handleVerify={handleWorldVerify}
            onSuccess={() => {
              setWorldWidgetOpen(false);
              setWorldSession(null);
            }}
            onError={(errorCode) => {
              setWorldWidgetOpen(false);
              setWorldSession(null);
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

        <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                WorldPrize
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                World ID-protected AMOE/free-entry demo for instant-win promos.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Product codes still work, but the free path is gated by a
                World ID proof in real mode. Mock mode keeps the interview demo
                quick and local.
              </p>
              <div className="mt-4 inline-flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  {modeLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
                  {worldAppLabel}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <a
                href="/audit"
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Public audit log
              </a>
              <button
                type="button"
                onClick={() => void refreshSnapshot()}
                className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {loading ? 'Refreshing…' : 'Refresh stats'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat
            label="Campaign"
            value={snapshot?.campaign.campaignName ?? 'Snack Drop 2026'}
          />
          <Stat
            label="Product-code entries"
            value={snapshot?.stats.productCodeEntries ?? 0}
          />
          <Stat
            label="Verified free entries"
            value={snapshot?.stats.freeWorldIdEntries ?? 0}
          />
          <Stat label="Winners" value={snapshot?.stats.winners ?? 0} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card eyebrow="Entry methods" title="Choose a promo path">
            <div className="grid gap-4 xl:grid-cols-2">
              <form
                className="rounded-3xl border border-white/10 bg-slate-950/50 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitEntry({
                    method: 'product_code',
                    code: formState.productCode,
                  });
                }}
              >
                <p className="text-lg font-semibold text-white">
                  I have a product code
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Simulates the purchase-driven path. Valid codes are accepted
                  once, then locked.
                </p>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Code
                  <input
                    value={formState.productCode}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        productCode: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/50"
                    placeholder="TREAT-001"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyAction === 'product_code'}
                  className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === 'product_code'
                    ? 'Checking code…'
                    : 'Enter with code'}
                </button>
              </form>

              <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                <p className="text-lg font-semibold text-white">
                  No purchase? Free daily entry with World ID
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {worldPrizeMode === 'real'
                    ? 'Real mode signs RP requests on the server, opens IDKit, verifies the proof server-side, then stores the nullifier.'
                    : 'Mock mode keeps the interview demo fast: the free path uses demo humans outside World App.'}
                </p>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Human label
                  <input
                    value={formState.humanLabel}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        humanLabel: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/50"
                    placeholder="Alice"
                  />
                </label>

                {worldPrizeMode === 'real' ? (
                  <button
                    type="button"
                    onClick={() =>
                      void submitEntry({
                        method: 'free_world_id',
                        humanLabel: formState.humanLabel,
                      })
                    }
                    disabled={busyAction === 'free_world_id'}
                    className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'free_world_id'
                      ? 'Opening IDKit…'
                      : 'Open World ID request'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void submitEntry({
                        method: 'free_world_id',
                        humanLabel: formState.humanLabel,
                      })
                    }
                    disabled={busyAction === 'free_world_id'}
                    className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === 'free_world_id'
                      ? 'Verifying human…'
                      : 'Verify & enter'}
                  </button>
                )}
              </div>
            </div>
          </Card>

          <Card eyebrow="Last result" title={entryTitle}>
            <div
              className={`rounded-3xl border p-5 ${statusTone(
                result?.status ?? 'LOSE',
              )}`}
            >
              {result ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                      {statusLabel(result.status)}
                    </p>
                    {result.prize ? (
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                        {result.prize}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-base leading-7">{result.detail}</p>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-300">Actor</dt>
                      <dd className="mt-1 font-medium text-white">
                        {result.actorMasked}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-300">Input</dt>
                      <dd className="mt-1 font-medium text-white">
                        {result.inputMasked}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-300">Method</dt>
                      <dd className="mt-1 font-medium text-white">
                        {result.method}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-300">Outcome</dt>
                      <dd className="mt-1 font-medium text-white">
                        {result.status}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-sm leading-6 text-slate-100/90">
                  Use a product code or a World ID proof to see the
                  instant-win response.
                </p>
              )}
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Public rules
                </p>
                <p className="mt-2 text-slate-200">
                  One verified human per campaign day, or one-time code use.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Config hash
                </p>
                <p className="mt-2 font-mono text-slate-200">
                  {snapshot?.campaign.campaignHash ?? '—'}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card eyebrow="Abuse simulator" title="Demo-only attack scenarios">
            <p className="text-sm leading-6 text-slate-300">
              These buttons are intentionally visible so the interview narrative
              can show the defensive story: duplicate humans are blocked,
              repeated codes are rejected, and bot-style requests fail without a
              proof.
            </p>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => void runSimulation('alice-five')}
                disabled={busyAction === 'alice-five'}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Simulate Alice trying 5 times
              </button>
              <button
                type="button"
                onClick={() => void runSimulation('bots-100')}
                disabled={busyAction === 'bots-100'}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Simulate 100 fake bot attempts
              </button>
              <button
                type="button"
                onClick={() => void runSimulation('reuse-code')}
                disabled={busyAction === 'reuse-code'}
                className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Simulate code reuse
              </button>
              <button
                type="button"
                onClick={() => void resetDemo()}
                disabled={busyAction === 'reset'}
                className="rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset demo state
              </button>
            </div>
          </Card>

          <Card eyebrow="Admin dashboard" title="Promo health at a glance">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Duplicate free attempts"
                value={snapshot?.stats.duplicateFreeAttempts ?? 0}
              />
              <Stat
                label="Invalid / reused codes"
                value={snapshot?.stats.invalidOrReusedCodes ?? 0}
              />
              <Stat
                label="Invalid proofs"
                value={snapshot?.stats.invalidProofAttempts ?? 0}
              />
              <Stat
                label="Prizes remaining"
                value={snapshot?.stats.prizesRemaining ?? 0}
              />
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Inventory
                </p>
                <span className="text-xs text-slate-400">
                  {snapshot?.campaign.freeEntryRule}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {snapshot && Object.keys(snapshot.stats.inventory).length > 0 ? (
                  Object.entries(snapshot.stats.inventory).map(
                    ([prize, count]) => (
                      <span
                        key={prize}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200"
                      >
                        {prize} × {count}
                      </span>
                    ),
                  )
                ) : (
                  <span className="text-sm text-slate-400">
                    All prizes have been claimed.
                  </span>
                )}
              </div>
            </div>
            <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-50">
              Demo only. No real prize is awarded. Promotion laws, eligibility,
              tax, age, regional restrictions, and no-purchase requirements
              still apply. World ID only helps reduce duplicate-human abuse on
              the free-entry path.
            </p>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card eyebrow="Public audit preview" title="Masked event trail">
            <p className="text-sm leading-6 text-slate-300">
              The audit trail keeps the story visible without exposing full
              nullifiers or raw identifiers.
            </p>
            <div className="mt-5 space-y-3">
              {recentEvents.length > 0 ? (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-white">
                        {event.method}
                      </p>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      {event.actorMasked} • {event.inputMasked}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{event.note}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">
                  No events yet. Enter a code or verify a human to populate the
                  audit log.
                </p>
              )}
            </div>
          </Card>

          <Card eyebrow="Interview talking points" title="How to frame WorldPrize">
            <ul className="space-y-3 text-sm leading-6 text-slate-300">
              <li>
                <span className="font-semibold text-white">What it is:</span> a
                small World ID reference integration for AMOE/free-entry
                protection.
              </li>
              <li>
                <span className="font-semibold text-white">What it is not:</span>{' '}
                a full raffle SaaS or legal compliance engine.
              </li>
              <li>
                <span className="font-semibold text-white">Why it matters:</span>{' '}
                it demonstrates a practical, privacy-preserving way to make the
                no-purchase path harder to farm.
              </li>
              <li>
                <span className="font-semibold text-white">
                  How to present it:
                </span>{' '}
                “Product codes still drive purchase engagement, while the free
                route becomes one verified human per day.”
              </li>
            </ul>
          </Card>
        </section>

        <footer className="pb-6 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          WorldPrize demo • {modeLabel.toLowerCase()} • server-backed state for
          the current process only
        </footer>
      </div>
    </div>
  );
}
