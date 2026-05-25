import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'StegoVault — Hidden in Plain Sight',
  description: 'AES-256 steganography with Shamir secret sharing. Hide encrypted messages inside images or files.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body className="noise scanline min-h-screen">
        {children}
      </body>
    </html>
  );
}
