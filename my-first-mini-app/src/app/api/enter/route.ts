import {
  enterFreeWorldId,
  enterProductCode,
  type EntryRequest,
} from '@/lib/worldprize/demo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as EntryRequest | null;

  if (!body || typeof body !== 'object' || !('method' in body)) {
    return Response.json({ error: 'Invalid entry payload' }, { status: 400 });
  }

  if (body.method === 'product_code') {
    return Response.json(enterProductCode(body.code, body.source));
  }

  if (body.method === 'free_world_id') {
    return Response.json(
      enterFreeWorldId(body.humanId, body.proof, body.source),
    );
  }

  return Response.json({ error: 'Unsupported method' }, { status: 400 });
}
