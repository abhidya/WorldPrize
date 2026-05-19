import { verifyWorldProof } from '@/lib/worldprize/world';
import type { VerificationProof } from '@worldprize/core';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { proof?: VerificationProof }
    | null;

  if (!body?.proof) {
    return Response.json({ ok: false, reason: 'MISSING_PROOF' }, { status: 400 });
  }

  const result = await verifyWorldProof(body.proof);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
