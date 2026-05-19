import { createWorldRpContext } from '@/lib/worldprize/world';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { action?: string }
    | null;

  if (!body?.action) {
    return Response.json({ error: 'Missing action' }, { status: 400 });
  }

  return Response.json(createWorldRpContext(body.action));
}
