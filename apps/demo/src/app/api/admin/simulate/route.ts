import { runSimulation, type SimulationResponse } from '@/lib/worldprize/demo';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    scenario?: SimulationResponse['scenario'];
  } | null;

  if (!body?.scenario) {
    return Response.json({ error: 'Missing scenario' }, { status: 400 });
  }

  return Response.json(await runSimulation(body.scenario));
}
