import { verifyWorldResult } from '@/lib/worldprize/world';
import type { IDKitResult } from '@worldcoin/idkit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { idkitResult?: IDKitResult }
    | null;

  if (!body?.idkitResult) {
    return Response.json({ verified: false, reason: 'MISSING_PROOF' }, { status: 400 });
  }

  const result = await verifyWorldResult(body.idkitResult);
  if (!result.ok) {
    return Response.json(
      { verified: false, reason: result.reason ?? 'INVALID_PROOF' },
      { status: 400 },
    );
  }

  return Response.json({
    verified: true,
    nullifier: result.nullifierHash,
  });
}

