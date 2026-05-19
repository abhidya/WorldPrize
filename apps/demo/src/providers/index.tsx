'use client';

import { MiniKitProvider } from '@worldcoin/minikit-js/minikit-provider';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
const worldAppId =
  process.env.NEXT_PUBLIC_WORLD_APP_ID ?? process.env.NEXT_PUBLIC_APP_ID;

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {worldAppId ? (
        <MiniKitProvider props={{ appId: worldAppId }}>
          {children}
        </MiniKitProvider>
      ) : (
        children
      )}
    </SessionProvider>
  );
}
