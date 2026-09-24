import type { Metadata, Viewport } from 'next';

// PWA del portal: se puede "instalar" y abre directo en el carnet
export const metadata: Metadata = {
  title: 'Portal del socio',
  manifest: '/socio/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Mi club', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#05070e',
};

export default function SocioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
