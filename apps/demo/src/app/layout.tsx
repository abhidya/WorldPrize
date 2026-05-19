import type { Metadata } from 'next';
import ClientProviders from '@/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorldPrize',
  description:
    'WorldPrize is a World ID reference integration for instant-win promotions and AMOE/free-entry flows.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
