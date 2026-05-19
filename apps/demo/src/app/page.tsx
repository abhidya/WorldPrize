import { WorldPrizeDemo } from '@/components/WorldPrizeDemo';
import { getWorldConfig } from '@/lib/worldprize/world';

export default function Home() {
  return <WorldPrizeDemo worldConfig={getWorldConfig()} />;
}

