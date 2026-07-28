'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession, getUser } from '@/lib/auth';
import { getPublicClub } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  socios:
    'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  disciplinas:
    'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
  cuotas:
    'M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z',
  asistencia:
    'M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  caja: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  reportes: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z',
  logout:
    'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
};

function Icon({ name, className = 'h-[18px] w-[18px]' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/admin/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/admin/socios/', label: 'Socios', icon: 'socios' },
  { href: '/admin/disciplinas/', label: 'Disciplinas', icon: 'disciplinas' },
  { href: '/admin/cuotas/', label: 'Cuotas', icon: 'cuotas' },
  { href: '/admin/asistencias/', label: 'Asistencia', icon: 'asistencia' },
  { href: '/admin/caja/', label: 'Caja', icon: 'caja' },
  { href: '/admin/reportes/', label: 'Reportes', icon: 'reportes' },
];

interface ClubInfo {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [club, setClub] = useState<ClubInfo>({ name: 'Mi Club' });
  const [menuOpen, setMenuOpen] = useState(false);
  const user = typeof window !== 'undefined' ? getUser() : null;

  useEffect(() => {
    getPublicClub()
      .then((c: ClubInfo) => {
        setClub(c);
        if (c.primaryColor) {
          document.documentElement.style.setProperty('--color-primary', c.primaryColor);
        }
        if (c.secondaryColor) {
          document.documentElement.style.setProperty('--color-secondary', c.secondaryColor);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push('/login/');
  };

  const isActive = (href: string) =>
    href === '/admin/'
      ? pathname === '/admin' || pathname === '/admin/'
      : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0a1410] text-white">
      {/* Club */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-5">
        {club.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.logoUrl} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold">
            {club.name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-bold leading-tight">
            {club.name}
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            Administración
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const linkClass = active
            ? 'bg-white/[0.07] text-white'
            : 'text-white/50 hover:bg-white/[0.04] hover:text-white';
          const iconClass = active
            ? 'text-primary'
            : 'text-white/40 group-hover:text-white/70';
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={
                'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ' +
                linkClass
              }
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  style={{ background: 'var(--color-primary)' }}
                />
              )}
              <span className={iconClass}>
                <Icon name={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white"
            style={{
              backgroundImage:
                'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            }}
          >
            {(user?.firstName?.[0] ?? 'U') + (user?.lastName?.[0] ?? '')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight">
              {user ? user.firstName + ' ' + user.lastName : 'Usuario'}
            </p>
            <p className="truncate text-[11px] text-white/40">{user?.role ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-white/40 transition-colors hover:text-red-400"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#f4f6f5]">
        {/* Sidebar desktop */}
        <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 lg:block">
          {sidebar}
        </aside>

        {/* Topbar mobile */}
        <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#0a1410] px-4 text-white lg:hidden">
          <div className="flex items-center gap-2.5">
            {club.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-8 w-8 object-contain" />
            )}
            <span className="font-display text-sm font-bold">{club.name}</span>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="px-2 text-2xl"
            aria-label="Menú"
          >
            ☰
          </button>
        </header>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <aside
              className="absolute left-0 top-0 h-full w-64"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebar}
            </aside>
          </div>
        )}

        <main className="px-5 pb-12 pt-20 lg:ml-64 lg:px-10 lg:pt-8">{children}</main>
      </div>
    </AuthGuard>
  );
}
