'use client';

import { Tabs, TabItem } from '@worldcoin/mini-apps-ui-kit-react';
import { Home, Reports, Shield } from '@worldcoin/mini-apps-ui-kit-react/icons/outline';
import { Home as HomeSolid, Reports as ReportsSolid, Shield as ShieldSolid } from '@worldcoin/mini-apps-ui-kit-react/icons/solid';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';

const tabs = [
  {
    value: '/',
    label: 'Home',
    icon: <Home />,
    altIcon: <HomeSolid />,
  },
  {
    value: '/admin',
    label: 'Admin',
    icon: <Reports />,
    altIcon: <ReportsSolid />,
  },
  {
    value: '/audit',
    label: 'Audit',
    icon: <Shield />,
    altIcon: <ShieldSolid />,
  },
] as const;

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = useMemo(() => {
    if (pathname === '/admin') return '/admin';
    if (pathname === '/audit') return '/audit';
    return '/';
  }, [pathname]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => router.push(value)}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.value}
          value={tab.value}
          icon={tab.icon}
          altIcon={tab.altIcon}
          label={tab.label}
        />
      ))}
    </Tabs>
  );
}
