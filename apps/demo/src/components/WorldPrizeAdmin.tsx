'use client';

import type { CampaignSnapshot } from '@/lib/worldprize/demo';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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

export function WorldPrizeAdmin() {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/stats', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load campaign snapshot');
      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  const resetDemo = useCallback(async () => {
    setBusyAction('reset');
    try {
      const response = await fetch('/api/admin/reset', { method: 'POST' });
      if (!response.ok) throw new Error('Reset failed');
      const data = (await response.json()) as CampaignSnapshot;
      setSnapshot(data);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const recentEvents = snapshot?.stats.recentEvents ?? [];

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.22),_transparent_32%),linear-gradient(180deg,#07111f_0%,#04070c_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                WorldPrize Admin
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Promo health at a glance
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Campaign metrics, inventory, and abuse-prevention counters for
                the current demo session. All state is in-memory and resets with
                the process.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void refreshSnapshot()}
                className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
              <Link
                href="/"
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
              >
                Back to demo
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <Stat
            label="Campaign"
            value={snapshot?.campaign.campaignName ?? '—'}
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

        <Card eyebrow="Abuse prevention" title="Defensive counters">
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
        </Card>

        <Card eyebrow="Inventory" title="Prize pool status">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Free-entry rule
            </p>
            <span className="text-xs text-slate-400">
              {snapshot?.campaign.freeEntryRule ?? '—'}
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
                    {prize} &times; {count}
                  </span>
                ),
              )
            ) : (
              <span className="text-sm text-slate-400">
                All prizes have been claimed.
              </span>
            )}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat
              label="Total entries"
              value={
                (snapshot?.stats.productCodeEntries ?? 0) +
                (snapshot?.stats.freeWorldIdEntries ?? 0)
              }
            />
            <Stat
              label="Win rate"
              value={
                snapshot &&
                (snapshot.stats.productCodeEntries +
                  snapshot.stats.freeWorldIdEntries) >
                  0
                  ? `${(
                      (snapshot.stats.winners /
                        (snapshot.stats.productCodeEntries +
                          snapshot.stats.freeWorldIdEntries)) *
                      100
                    ).toFixed(1)}%`
                  : '—'
              }
            />
            <Stat
              label="Campaign status"
              value={snapshot?.campaign.active ? 'ACTIVE' : 'PAUSED'}
            />
          </div>
        </Card>

        <Card eyebrow="Event trail" title="Recent masked audit events">
          <div className="space-y-3">
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
                    {event.actorMasked} &bull; {event.inputMasked}
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

        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void resetDemo()}
            disabled={busyAction === 'reset'}
            className="rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'reset' ? 'Resetting…' : 'Reset demo state'}
          </button>
          <p className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-50 sm:max-w-md">
            Demo only. No real prize is awarded. Promotion laws, eligibility,
            tax, age, regional restrictions, and no-purchase requirements still
            apply. World ID only helps reduce duplicate-human abuse on the
            free-entry path.
          </p>
        </section>

        <footer className="pb-6 text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          WorldPrize admin &bull; in-memory demo state
        </footer>
      </div>
    </div>
  );
}
