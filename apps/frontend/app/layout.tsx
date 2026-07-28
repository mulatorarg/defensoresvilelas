import type { Metadata } from 'next';
import { Bricolage_Grotesque, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-body' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Clubes - Gestión deportiva',
  description: 'Sistema de gestión para clubes deportivos e instituciones',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${manrope.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
