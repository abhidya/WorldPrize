import { verifyWorldIdResult } from '@/lib/worldprize/world';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { idkitResult?: unknown }
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
        message:
          result.reason === 'MISSING_NULLIFIER'
            ? 'World ID verification did not produce a nullifier hash.'
            : 'World ID verification failed.',
        debugShape: result.debugShape ?? null,
      },
      { status: 400 },
    );
  }

  return Response.json({
    verified: true,
    nullifier: result.nullifierHash,
  });
}
