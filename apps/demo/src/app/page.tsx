import { WorldPrizeDemo } from '@/components/WorldPrizeDemo';
import { getWorldConfig } from '@/lib/worldprize/world';

export default function Home() {
  const config = getWorldConfig();
  return (
    <WorldPrizeDemo
      worldConfig={{
        mode: config.mode,
        appId: config.appId,
        rpId: config.rpId,
        actionFreeEntry: config.actionFreeEntry,
        signingKeyConfigured: config.signingKeyConfigured,
      }}
    />
  );
}
