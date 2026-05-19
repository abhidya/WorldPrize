'use client';

import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

const worldAppId = process.env.NEXT_PUBLIC_WORLD_APP_ID;

function MissingMiniKitAppIdFallback({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'NEXT_PUBLIC_WORLD_APP_ID is not configured; MiniKit is disabled for this render.',
      );
    }
  }, []);

  return <>{children}</>;
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  if (!worldAppId) {
    return <MissingMiniKitAppIdFallback>{children}</MissingMiniKitAppIdFallback>;
  }

  return <MiniKitProvider props={{ appId: worldAppId }}>{children}</MiniKitProvider>;
}
