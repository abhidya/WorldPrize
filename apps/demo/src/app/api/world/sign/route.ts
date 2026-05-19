// This is mock/placeholder scaffolding for the interview demo. Production real mode must use IDKit/World App proof generation, backend RP signing, verification at the World verifier endpoint, and persistent nullifier storage.
import { createWorldRpContext } from '@/lib/worldprize/world';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string }
    | null;

  if (!body?.action) {
    return Response.json({ error: 'Missing action' }, { status: 400 });
  }

  const rpContext = createWorldRpContext(body.action);

  return Response.json({
    sig: rpContext.signature,
    nonce: rpContext.nonce,
    created_at: rpContext.created_at,
    expires_at: rpContext.expires_at,
  });
}
