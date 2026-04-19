import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import DynamicFavicon from '@/components/DynamicFavicon';

export const metadata: Metadata = {
  title: 'OutSail Proposal Analyzer',
  description: 'Compare HRIS/HR Tech vendor proposals side-by-side',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <SessionProvider>
          <DynamicFavicon />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
