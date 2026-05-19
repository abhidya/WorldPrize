import { getSnapshot } from '@/lib/worldprize/demo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(getSnapshot());
}
