import {
  enterDemoEntry,
  type DemoEntryPayload,
} from '@/lib/worldprize/demo';
import { verifyWorldIdResult } from '@/lib/worldprize/world';
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
              detail: 'Real mode requires a World ID proof. No IDKit result was provided.',
              actorMasked: 'guest',
              inputMasked: 'n/a',
            },
            stats: { campaignActive: true, productCodeEntries: 0, freeWorldIdEntries: 0, duplicateFreeAttempts: 0, invalidOrReusedCodes: 0, invalidProofAttempts: 1, winners: 0, prizesRemaining: 0, campaignConfigHash: '', inventory: {}, recentEvents: [] },
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
              detail: `World ID verification failed: ${verification.reason ?? 'INVALID_PROOF'}`,
              actorMasked: 'guest',
              inputMasked: 'n/a',
            },
            stats: { campaignActive: true, productCodeEntries: 0, freeWorldIdEntries: 0, duplicateFreeAttempts: 0, invalidOrReusedCodes: 0, invalidProofAttempts: 1, winners: 0, prizesRemaining: 0, campaignConfigHash: '', inventory: {}, recentEvents: [] },
          },
          { status: 400 },
        );
      }

      body.verificationResult = {
        verified: true as const,
        nullifier: verification.nullifierHash!,
      };
    }
  }

  const result = await enterDemoEntry(body);
  return Response.json(result);
}

