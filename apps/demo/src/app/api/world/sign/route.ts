import { buildWorldRpContext, getWorldConfig } from '@/lib/worldprize/world';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string }
    | null;

  if (!body?.action) {
    return Response.json({ error: 'Missing action' }, { status: 400 });
  }

  const rpContext = buildWorldRpContext(body.action);
  const { rpId } = getWorldConfig();

  return Response.json({
    sig: rpContext.signature,
    nonce: rpContext.nonce,
    created_at: rpContext.created_at,
    expires_at: rpContext.expires_at,
    rp_id: rpId,
  });
}

