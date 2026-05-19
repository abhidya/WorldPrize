import { resetDemoState } from '@/lib/worldprize/demo';

export const dynamic = 'force-dynamic';

export async function POST() {
  return Response.json(resetDemoState());
}
