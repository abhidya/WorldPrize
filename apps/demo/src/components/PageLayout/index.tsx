import { BottomBar, TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import type { ReactNode } from 'react';
import { Navigation } from '@/components/Navigation';

export function PageLayoutHeader({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <TopBar>
      <div className="flex w-full items-center justify-between px-4 py-3">
        {children}
      </div>
    </TopBar>
  );
}

export function PageLayoutMain({
  children,
}: {
  children: ReactNode;
}) {
  return <main className="flex-1">{children}</main>;
}

export function PageLayoutFooter() {
  return (
    <BottomBar direction="horizontal">
      <Navigation />
    </BottomBar>
  );
}

export function PageLayout({
  children,
  header,
}: {
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-950">
      {header ? <PageLayoutHeader>{header}</PageLayoutHeader> : null}
      <PageLayoutMain>{children}</PageLayoutMain>
      <PageLayoutFooter />
    </div>
  );
}
