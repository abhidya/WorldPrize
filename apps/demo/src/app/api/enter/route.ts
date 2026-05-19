import { enterDemoEntry, type DemoEntryPayload } from '@/lib/worldprize/demo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | DemoEntryPayload
    | null;

  if (!body || typeof body !== 'object' || !('method' in body)) {
    return Response.json({ error: 'Invalid entry payload' }, { status: 400 });
  }

  const result = await enterDemoEntry(body);
  return Response.json(result);
}

