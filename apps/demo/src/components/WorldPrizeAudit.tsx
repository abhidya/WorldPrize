'use client';

import type { CampaignSnapshot } from '@/lib/worldprize/demo';
import { useCallback, useEffect, useState } from 'react';

export function WorldPrizeAudit() {
  const [snapshot, setSnapshot] = useState<CampaignSnapshot | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/admin/stats', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to load audit snapshot');
    }
    const data = (await response.json()) as CampaignSnapshot;
    setSnapshot(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const events = snapshot?.audit ?? [];

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">
                Public audit
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Masked trail for WorldPrize
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                This page shows the public-facing evidence view: campaign status,
                counts, and masked identifiers only. Full nullifiers never leave
                the server snapshot.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Campaign status
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {snapshot?.campaign.active ? 'ACTIVE' : 'PAUSED'}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Winner count
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {snapshot?.stats.winners ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Config hash
            </p>
            <p className="mt-2 font-mono text-sm text-white">
              {snapshot?.campaign.campaignHash ?? '—'}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">
              Required audit fields
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>
                Campaign status:{' '}
                {snapshot?.campaign.active ? 'ACTIVE' : 'PAUSED'}
              </p>
              <p>Entry counts: {snapshot?.stats.productCodeEntries ?? 0} code / {snapshot?.stats.freeWorldIdEntries ?? 0} free</p>
              <p>Duplicate blocked: {snapshot?.stats.duplicateFreeAttempts ?? 0}</p>
              <p>Winner count: {snapshot?.stats.winners ?? 0}</p>
              <p>Masked entry IDs: shown below in the event trail</p>
              <p>
                Campaign config hash: {snapshot?.campaign.campaignHash ?? '—'}
              </p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">Event trail</h2>
            <div className="mt-4 space-y-3">
              {events.length > 0 ? (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
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
                <p className="text-sm text-slate-400">No entries yet.</p>
              )}
            </div>
          </div>
        </section>

        <div className="text-center text-xs uppercase tracking-[0.25em] text-slate-500">
          No full nullifier hashes are displayed here.
        </div>
      </div>
    </div>
  );
}
