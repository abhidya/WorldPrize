import { verifyWorldIdResult } from '@/lib/worldprize/world';
import type { IDKitResult } from '@worldcoin/idkit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { idkitResult?: IDKitResult }
    | IDKitResult
    | null;

  const payload =
    body && typeof body === 'object' && 'idkitResult' in body
      ? body.idkitResult
      : body;

  if (!payload) {
    return Response.json({ verified: false, reason: 'MISSING_PROOF' }, { status: 400 });
  }

  const result = await verifyWorldIdResult(payload);
  if (!result.ok) {
    return Response.json(
      {
        verified: false,
        reason: result.reason ?? 'INVALID_PROOF',
        verification: result.verification ?? null,
      },
      { status: 400 },
    );
  }

  return Response.json({
    verified: true,
    nullifier: result.nullifierHash,
    verification: result.verification ?? null,
  });
}
