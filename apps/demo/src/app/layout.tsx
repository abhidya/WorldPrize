import type { Metadata } from 'next';
import ClientProviders from '@/providers';
import { Navigation } from '@/components/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorldPrize',
  description:
    'WorldPrize is a World ID reference integration for instant-win promotions and AMOE/free-entry flows.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-slate-950">
        <ClientProviders>
          <main className="flex-1">{children}</main>
          <nav className="sticky bottom-0 z-50 border-t border-white/10 bg-slate-950/95 backdrop-blur">
            <Navigation />
          </nav>
        </ClientProviders>
      </body>
    </html>
  );
}
