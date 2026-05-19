import {
  enterDemoEntry,
  type DemoEntryPayload,
} from '@/lib/worldprize/demo';
import { getWorldConfig, verifyWorldIdResult } from '@/lib/worldprize/world';
import { normalizeWorldPrizeMode } from '@/lib/worldprize/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | DemoEntryPayload
    | null;

  if (!body || typeof body !== 'object' || !('method' in body)) {
    return Response.json({ error: 'Invalid entry payload' }, { status: 400 });
  }

  if (body.method === 'free_world_id') {
    const mode = normalizeWorldPrizeMode(
      process.env.WORLDPRIZE_MODE ?? process.env.NEXT_PUBLIC_WORLDPRIZE_MODE,
    );

    if (mode === 'real') {
      const idkitResult = body.idkitResult;
      if (!idkitResult) {
        return Response.json(
          {
            success: false,
            result: {
              method: 'free_world_id',
              status: 'INVALID_PROOF',
              headline: 'Proof rejected',
              detail:
                'Real mode requires a World ID proof. No IDKit result was provided.',
              actorMasked: 'verified human',
              inputMasked: 'World ID proof',
            },
            stats: {
              campaignActive: true,
              productCodeEntries: 0,
              freeWorldIdEntries: 0,
              duplicateFreeAttempts: 0,
              invalidOrReusedCodes: 0,
              invalidProofAttempts: 1,
              winners: 0,
              prizesRemaining: 0,
              campaignConfigHash: '',
              inventory: {},
              recentEvents: [],
            },
          },
          { status: 400 },
        );
      }

      const verification = await verifyWorldIdResult(idkitResult);
      if (!verification.ok) {
        return Response.json(
          {
            success: false,
            result: {
              method: 'free_world_id',
              status: 'INVALID_PROOF',
              headline: 'Proof rejected',
              detail:
                verification.reason === 'MISSING_NULLIFIER'
                  ? 'World ID verification did not produce a nullifier hash.'
                  : `World ID verification failed: ${verification.reason ?? 'INVALID_PROOF'}`,
              actorMasked: 'verified human',
              inputMasked: 'World ID proof',
            },
            stats: {
              campaignActive: true,
              productCodeEntries: 0,
              freeWorldIdEntries: 0,
              duplicateFreeAttempts: 0,
              invalidOrReusedCodes: 0,
              invalidProofAttempts: 1,
              winners: 0,
              prizesRemaining: 0,
              campaignConfigHash: '',
              inventory: {},
              recentEvents: [],
            },
          },
          { status: 400 },
        );
      }

      const { actionFreeEntry } = getWorldConfig();
      const result = await enterDemoEntry({
        method: 'free_world_id',
        source: 'world-id',
        dayKey: body.dayKey,
        proof: {
          action: actionFreeEntry,
          dayKey: body.dayKey ?? new Date().toISOString().slice(0, 10),
          humanLabel: 'verified human',
          payload: {
            verified: true as const,
            nullifier: verification.nullifierHash!,
          },
        },
      });

      return Response.json(result);
    }
  }

  const result = await enterDemoEntry(body);
  return Response.json(result);
}
