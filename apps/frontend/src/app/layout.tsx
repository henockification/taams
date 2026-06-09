import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import '@/styles/globals.css';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: 'Taams',
  description: 'Taams application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme-preset="tangerine" className={poppins.variable}>
      <body suppressHydrationWarning className="font-[family-name:var(--font-poppins)] antialiased">
        {children}
      </body>
    </html>
  );
}
