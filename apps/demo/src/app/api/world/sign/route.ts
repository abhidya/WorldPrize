import { buildWorldProof, getWorldConfig } from '@/lib/worldprize/world';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { humanLabel?: string; dayKey?: string }
    | null;

  if (!body?.humanLabel) {
    return Response.json({ error: 'Missing humanLabel' }, { status: 400 });
  }

  const dayKey = body.dayKey ?? new Date().toISOString().slice(0, 10);
  const proof = buildWorldProof({ humanLabel: body.humanLabel, dayKey });

  return Response.json({
    ...getWorldConfig(),
    proof,
  });
}
